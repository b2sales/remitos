import { useCallback, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Alert,
  LinearProgress,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { remitosApi } from '@/services/remitos';
import { b2salesBlue } from '@/theme';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface FileEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  errorMsg?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const entries: FileEntry[] = [];
    for (const file of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        entries.push({
          file,
          status: 'error',
          progress: 0,
          errorMsg: 'Tipo no soportado',
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        entries.push({
          file,
          status: 'error',
          progress: 0,
          errorMsg: 'Archivo mayor a 10MB',
        });
        continue;
      }
      entries.push({ file, status: 'pending', progress: 0 });
    }
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleUpload = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    setUploading(true);
    setGlobalError(null);
    setSuccessCount(0);

    try {
      const presignResponse = await remitosApi.getUploadUrls(
        pending.map((f) => ({
          filename: f.file.name,
          content_type: f.file.type,
        })),
      );

      let doneCount = 0;

      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        const presign = presignResponse.uploads[i];
        const fileIndex = files.indexOf(entry);

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'uploading', progress: 30 } : f,
          ),
        );

        try {
          const response = await fetch(presign.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': entry.file.type },
            body: entry.file,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          doneCount++;
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'done', progress: 100 } : f,
            ),
          );
        } catch (err) {
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? {
                    ...f,
                    status: 'error',
                    progress: 0,
                    errorMsg: err instanceof Error ? err.message : 'Error de subida',
                  }
                : f,
            ),
          );
        }
      }

      setSuccessCount(doneCount);
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'Error al obtener URLs de subida',
      );
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Cargar remitos
      </Typography>

      {globalError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGlobalError(null)}>
          {globalError}
        </Alert>
      )}

      {successCount > 0 && !uploading && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successCount} remito{successCount > 1 ? 's' : ''} subido{successCount > 1 ? 's' : ''} correctamente.
          El sistema los procesará automáticamente (OCR → IA → Validación).
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Paper
            variant="outlined"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            sx={{
              p: 5,
              textAlign: 'center',
              cursor: 'pointer',
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: dragOver ? 'primary.main' : 'divider',
              backgroundColor: dragOver ? `${b2salesBlue}08` : 'transparent',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.light',
                backgroundColor: `${b2salesBlue}04`,
              },
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.tiff,.tif,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <CloudUploadIcon
              sx={{ fontSize: 48, color: 'primary.main', mb: 1 }}
            />
            <Typography variant="h6" gutterBottom>
              Arrastrá imágenes acá o hacé click para seleccionar
            </Typography>
            <Typography variant="body2" color="text.secondary">
              JPG, PNG, TIFF o PDF — Máximo 10MB por archivo — Hasta 20 archivos
            </Typography>
          </Paper>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">
                Archivos ({files.length})
              </Typography>
              <Stack direction="row" spacing={1}>
                {doneCount > 0 && (
                  <Chip
                    label={`${doneCount} subido${doneCount > 1 ? 's' : ''}`}
                    color="success"
                    size="small"
                  />
                )}
                {pendingCount > 0 && (
                  <Chip
                    label={`${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`}
                    color="warning"
                    size="small"
                  />
                )}
              </Stack>
            </Stack>

            <List dense>
              {files.map((entry, index) => (
                <ListItem
                  key={`${entry.file.name}-${index}`}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor:
                      entry.status === 'done'
                        ? 'success.50'
                        : entry.status === 'error'
                          ? 'error.50'
                          : undefined,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {entry.status === 'done' ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : entry.status === 'error' ? (
                      <ErrorOutlineIcon color="error" fontSize="small" />
                    ) : (
                      <InsertDriveFileIcon color="action" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.file.name}
                    secondary={
                      entry.status === 'error'
                        ? entry.errorMsg
                        : entry.status === 'uploading'
                          ? 'Subiendo...'
                          : entry.status === 'done'
                            ? 'Procesando automáticamente'
                            : `${(entry.file.size / 1024).toFixed(0)} KB`
                    }
                    primaryTypographyProps={{ fontSize: 14 }}
                    secondaryTypographyProps={{
                      fontSize: 12,
                      color: entry.status === 'error' ? 'error.main' : undefined,
                    }}
                  />
                  {entry.status === 'uploading' && (
                    <Box sx={{ width: 100, mr: 2 }}>
                      <LinearProgress variant="indeterminate" />
                    </Box>
                  )}
                  <ListItemSecondaryAction>
                    {(entry.status === 'pending' || entry.status === 'error') && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => removeFile(index)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setFiles([]);
                  setSuccessCount(0);
                }}
                disabled={uploading}
              >
                Limpiar
              </Button>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handleUpload}
                disabled={uploading || pendingCount === 0}
              >
                {uploading
                  ? 'Subiendo...'
                  : `Subir ${pendingCount} archivo${pendingCount !== 1 ? 's' : ''}`}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
