# sync-remitos.ps1
# Watches a folder for new scanned remitos and uploads them to S3.
#
# Setup:
#   1. Install AWS CLI: https://aws.amazon.com/cli/
#   2. Run: aws configure --profile remitos-scanner
#      (use the Access Key ID and Secret from the CDK deploy output)
#   3. Edit $CONFIG below with your paths and bucket name
#   4. Run manually or schedule with Task Scheduler

$CONFIG = @{
    WatchFolder    = "C:\Remitos\nuevos"
    DoneFolder     = "C:\Remitos\procesados"
    ErrorFolder    = "C:\Remitos\errores"
    LogFile        = "C:\Remitos\sync.log"
    S3Bucket       = "BUCKET_NAME_HERE"
    S3Prefix       = "uploads/"
    AwsProfile     = "remitos-scanner"
    AwsRegion      = "us-east-1"
    Extensions     = @("*.pdf", "*.jpg", "*.jpeg", "*.png", "*.tiff", "*.tif")
    PollIntervalSec = 10
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "$timestamp | $Message"
    Write-Host $entry
    Add-Content -Path $CONFIG.LogFile -Value $entry
}

# Create folders if they don't exist
foreach ($folder in @($CONFIG.WatchFolder, $CONFIG.DoneFolder, $CONFIG.ErrorFolder)) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Log "Created folder: $folder"
    }
}

Write-Log "=== Remitos Scanner Sync started ==="
Write-Log "Watching: $($CONFIG.WatchFolder)"
Write-Log "Bucket: $($CONFIG.S3Bucket)/$($CONFIG.S3Prefix)"

while ($true) {
    $files = @()
    foreach ($ext in $CONFIG.Extensions) {
        $files += Get-ChildItem -Path $CONFIG.WatchFolder -Filter $ext -File 2>$null
    }

    if ($files.Count -gt 0) {
        Write-Log "Found $($files.Count) file(s) to upload"
    }

    foreach ($file in $files) {
        $s3Key = "$($CONFIG.S3Prefix)$($file.Name)"

        try {
            $result = aws s3 cp $file.FullName "s3://$($CONFIG.S3Bucket)/$s3Key" `
                --profile $CONFIG.AwsProfile `
                --region $CONFIG.AwsRegion 2>&1

            if ($LASTEXITCODE -eq 0) {
                Move-Item -Path $file.FullName -Destination "$($CONFIG.DoneFolder)\$($file.Name)" -Force
                Write-Log "OK: $($file.Name) -> s3://$($CONFIG.S3Bucket)/$s3Key"
            } else {
                Move-Item -Path $file.FullName -Destination "$($CONFIG.ErrorFolder)\$($file.Name)" -Force
                Write-Log "ERROR uploading $($file.Name): $result"
            }
        } catch {
            Move-Item -Path $file.FullName -Destination "$($CONFIG.ErrorFolder)\$($file.Name)" -Force
            Write-Log "EXCEPTION uploading $($file.Name): $_"
        }
    }

    Start-Sleep -Seconds $CONFIG.PollIntervalSec
}
