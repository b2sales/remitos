import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import StatusChip from '@/components/StatusChip';
import {
  remitosApi,
  type RemitoDetail,
  type ValidarRemitoPayload,
} from '@/services/remitos';

interface FormFields {
  remitente: string;
  destinatario: string;
  tipo_carga: string;
  unidades: string;
  bultos: string;
  peso_kg: string;
  volumen_m3: string;
  observaciones: string;
}

const fieldLabels: Record<keyof FormFields, string> = {
  remitente: 'Remitente',
  destinatario: 'Destinatario',
  tipo_carga: 'Tipo de carga',
  unidades: 'Unidades',
  bultos: 'Bultos',
  peso_kg: 'Peso (kg)',
  volumen_m3: 'Volumen (m³)',
  observaciones: 'Observaciones',
};

export default function ValidationPage() {
  const { remitoId } = useParams<{ remitoId: string }>();
  const navigate = useNavigate();

  const [remito, setRemito] = useState<RemitoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<FormFields>({
    remitente: '',
    destinatario: '',
    tipo_carga: '',
    unidades: '',
    bultos: '',
    peso_kg: '',
    volumen_m3: '',
    observaciones: '',
  });
  const [originalValues, setOriginalValues] = useState<FormFields | null>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const loadRemito = useCallback(async () => {
    if (!remitoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await remitosApi.getDetail(remitoId);
      setRemito(data);
      const initial: FormFields = {
        remitente: data.datos_ia?.remitente ?? '',
        destinatario: data.datos_ia?.destinatario ?? '',
        tipo_carga: data.datos_ia?.tipo_carga ?? '',
        unidades: data.datos_ia?.unidades?.toString() ?? '',
        bultos: data.datos_ia?.bultos?.toString() ?? '',
        peso_kg: data.datos_ia?.peso_kg?.toString() ?? '',
        volumen_m3: data.datos_ia?.volumen_m3?.toString() ?? '',
        observaciones: data.datos_ia?.observaciones ?? '',
      };
      setForm(initial);
      setOriginalValues(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar remito');
    } finally {
      setLoading(false);
    }
  }, [remitoId]);

  useEffect(() => {
    loadRemito();
  }, [loadRemito]);

  const handleChange = (field: keyof FormFields) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const getCorrectedFields = (): string[] => {
    if (!originalValues) return [];
    return (Object.keys(form) as (keyof FormFields)[]).filter(
      (key) => form[key] !== originalValues[key],
    );
  };

  const handleSubmit = async () => {
    if (!remitoId) return;
    setSubmitting(true);
    setError(null);

    const corrected = getCorrectedFields();

    const payload: ValidarRemitoPayload = {
      remitente: form.remitente,
      destinatario: form.destinatario,
      tipo_carga: form.tipo_carga,
      unidades: form.unidades ? Number(form.unidades) : undefined,
      bultos: form.bultos ? Number(form.bultos) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      volumen_m3: form.volumen_m3 ? Number(form.volumen_m3) : undefined,
      observaciones: form.observaciones || undefined,
      campos_corregidos: corrected,
    };

    try {
      await remitosApi.validar(remitoId, payload);
      setSuccess(true);
      setTimeout(() => navigate('/validacion'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al validar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (!remito) {
    return (
      <Alert severity="error">
        No se encontró el remito. <Button onClick={() => navigate('/validacion')}>Volver</Button>
      </Alert>
    );
  }

  const confianza = remito.datos_ia?.confianza ?? {};

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/validacion')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">
          Validar remito
        </Typography>
        <Typography variant="body2" fontFamily="monospace" color="text.secondary">
          {remito.remito_id.slice(0, 12)}...
        </Typography>
        <StatusChip estado={remito.estado} />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Remito validado correctamente. Redirigiendo...
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left: Image viewer */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 1 }}>
              <Stack direction="row" spacing={0.5} sx={{ mb: 1, justifyContent: 'center' }}>
                <Tooltip title="Acercar">
                  <IconButton
                    size="small"
                    onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                  >
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Alejar">
                  <IconButton
                    size="small"
                    onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                  >
                    <ZoomOutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Rotar">
                  <IconButton
                    size="small"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                  >
                    <RotateRightIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ lineHeight: '34px', px: 1 }}>
                  {Math.round(zoom * 100)}%
                </Typography>
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 260px)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  backgroundColor: '#F0F0F0',
                }}
              >
                <Box
                  component="img"
                  src={remito.imagen_url}
                  alt="Remito escaneado"
                  sx={{
                    maxWidth: '100%',
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Right: Validation form */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Datos extraídos por IA
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Revisá y corregí los campos. Los campos modificados se registran
                automáticamente.
              </Typography>

              <Stack spacing={2.5}>
                {(
                  [
                    'remitente',
                    'destinatario',
                    'tipo_carga',
                  ] as (keyof FormFields)[]
                ).map((field) => (
                  <TextField
                    key={field}
                    label={
                      <Stack direction="row" alignItems="center" component="span">
                        {fieldLabels[field]}
                        {confianza[field] != null && (
                          <ConfidenceBadge
                            value={confianza[field]}
                            field={fieldLabels[field]}
                          />
                        )}
                      </Stack>
                    }
                    value={form[field]}
                    onChange={handleChange(field)}
                    fullWidth
                    required={field !== 'tipo_carga'}
                    variant="outlined"
                    color={
                      originalValues && form[field] !== originalValues[field]
                        ? 'warning'
                        : 'primary'
                    }
                    focused={
                      originalValues ? form[field] !== originalValues[field] : undefined
                    }
                  />
                ))}

                <Divider />

                <Grid container spacing={2}>
                  {(
                    ['unidades', 'bultos', 'peso_kg', 'volumen_m3'] as (keyof FormFields)[]
                  ).map((field) => (
                    <Grid size={{ xs: 6 }} key={field}>
                      <TextField
                        label={
                          <Stack direction="row" alignItems="center" component="span">
                            {fieldLabels[field]}
                            {confianza[field] != null && (
                              <ConfidenceBadge
                                value={confianza[field]}
                                field={fieldLabels[field]}
                              />
                            )}
                          </Stack>
                        }
                        value={form[field]}
                        onChange={handleChange(field)}
                        fullWidth
                        type="number"
                        variant="outlined"
                        color={
                          originalValues && form[field] !== originalValues[field]
                            ? 'warning'
                            : 'primary'
                        }
                        focused={
                          originalValues ? form[field] !== originalValues[field] : undefined
                        }
                      />
                    </Grid>
                  ))}
                </Grid>

                <TextField
                  label={fieldLabels.observaciones}
                  value={form.observaciones}
                  onChange={handleChange('observaciones')}
                  fullWidth
                  multiline
                  rows={3}
                  variant="outlined"
                  color={
                    originalValues && form.observaciones !== originalValues.observaciones
                      ? 'warning'
                      : 'primary'
                  }
                />

                {getCorrectedFields().length > 0 && (
                  <Alert severity="info" variant="outlined">
                    Campos corregidos:{' '}
                    {getCorrectedFields()
                      .map((f) => fieldLabels[f as keyof FormFields])
                      .join(', ')}
                  </Alert>
                )}

                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/validacion')}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleSubmit}
                    disabled={submitting || !form.remitente || !form.destinatario}
                  >
                    {submitting ? 'Validando...' : 'Confirmar validación'}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
