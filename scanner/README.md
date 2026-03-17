# Scanner - Sincronización de Remitos

Script de PowerShell que monitorea una carpeta local y sube automáticamente los remitos escaneados a S3.

## Requisitos

- Windows 10/11
- [AWS CLI](https://aws.amazon.com/cli/) instalado
- Credenciales del usuario `remitos-scanner` (se obtienen del output del deploy de CDK)

## Instalación

1. Instalar AWS CLI si no está instalado
2. Configurar el perfil con las credenciales del scanner:

```powershell
aws configure --profile remitos-scanner
# Access Key ID: (del output de CDK: ScannerAccessKeyId)
# Secret Access Key: (del output de CDK: ScannerSecretAccessKey)
# Region: us-east-1
# Output format: json
```

3. Editar `sync-remitos.ps1` y cambiar `BUCKET_NAME_HERE` por el nombre real del bucket (del output de CDK: UploadBucketName)

4. Crear las carpetas (o el script las crea automáticamente):
   - `C:\Remitos\nuevos\` — el escáner guarda acá
   - `C:\Remitos\procesados\` — archivos ya subidos
   - `C:\Remitos\errores\` — archivos con error de upload

## Uso manual

```powershell
powershell -ExecutionPolicy Bypass -File sync-remitos.ps1
```

## Ejecución automática con Task Scheduler

1. Abrir Task Scheduler
2. Create Task > General: "Remitos Sync", Run whether user is logged on or not
3. Triggers: At startup, Repeat every 1 minute (or at logon)
4. Actions: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Remitos\sync-remitos.ps1"`
5. Conditions: Start only if network connection is available

## Flujo

```
Escáner → C:\Remitos\nuevos\ → Script → S3 uploads/ → Lambda → Textract → DynamoDB
```

Los archivos se suben con prefijo `uploads/` en S3, lo que dispara automáticamente el pipeline de OCR.
