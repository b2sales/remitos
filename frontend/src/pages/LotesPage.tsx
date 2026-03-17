import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { lotesApi, type LoteListItem, type LoteDetail, type LoteEstado, type GuiaResponse } from '@/services/lotes';
import { b2salesBlue } from '@/theme';

const estadoColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  abierto: 'warning',
  cerrado: 'primary',
  en_validacion: 'info',
  validado: 'success',
  enviado: 'default',
};

const estadoLabels: Record<string, string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  en_validacion: 'En validación',
  validado: 'Validado',
  enviado: 'Enviado',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LotesPage() {
  const [estadoFilter, setEstadoFilter] = useState<LoteEstado>('cerrado');
  const [lotes, setLotes] = useState<LoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedLote, setExpandedLote] = useState<string | null>(null);
  const [loteDetail, setLoteDetail] = useState<LoteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [guiaDialog, setGuiaDialog] = useState<string | null>(null);
  const [generatingGuia, setGeneratingGuia] = useState(false);
  const [guiaResult, setGuiaResult] = useState<GuiaResponse | null>(null);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await lotesApi.list(estadoFilter);
      setLotes(data.items);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al cargar lotes');
    } finally {
      setLoading(false);
    }
  }, [estadoFilter]);

  useEffect(() => {
    fetchLotes();
  }, [fetchLotes]);

  const handleExpandLote = async (loteId: string) => {
    if (expandedLote === loteId) {
      setExpandedLote(null);
      setLoteDetail(null);
      return;
    }

    setExpandedLote(loteId);
    setLoadingDetail(true);
    try {
      const detail = await lotesApi.getDetail(loteId);
      setLoteDetail(detail);
    } catch {
      setLoteDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGenerarGuia = async (loteId: string) => {
    setGeneratingGuia(true);
    setGuiaResult(null);
    try {
      const result = await lotesApi.generarGuia(loteId);
      setGuiaResult(result);
      fetchLotes();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al generar guía');
      setGuiaDialog(null);
    } finally {
      setGeneratingGuia(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight={700}>
          Gestión de Lotes
        </Typography>
        <Button variant="outlined" onClick={fetchLotes}>
          Actualizar
        </Button>
      </Stack>

      <ToggleButtonGroup
        value={estadoFilter}
        exclusive
        onChange={(_, val) => val && setEstadoFilter(val)}
        sx={{ mb: 3 }}
      >
        <ToggleButton value="abierto">Abiertos</ToggleButton>
        <ToggleButton value="cerrado">Cerrados</ToggleButton>
        <ToggleButton value="enviado">Enviados</ToggleButton>
      </ToggleButtonGroup>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : lotes.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" textAlign="center">
              No hay lotes con estado "{estadoLabels[estadoFilter] ?? estadoFilter}"
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Lote ID</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Remitos</TableCell>
                <TableCell>Abierto</TableCell>
                <TableCell>Cerrado</TableCell>
                <TableCell>Guía</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lotes.map((lote) => (
                <>
                  <TableRow
                    key={lote.lote_id}
                    hover
                    sx={{ cursor: 'pointer', '& > *': { borderBottom: expandedLote === lote.lote_id ? 0 : undefined } }}
                    onClick={() => handleExpandLote(lote.lote_id)}
                  >
                    <TableCell>
                      <IconButton size="small">
                        {expandedLote === lote.lote_id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {lote.lote_id.slice(0, 8)}…
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={lote.tipo === 'urgente' ? 'Urgente' : 'Normal'}
                        color={lote.tipo === 'urgente' ? 'error' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={estadoLabels[lote.estado] ?? lote.estado}
                        color={estadoColors[lote.estado] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{lote.remitos_count}</TableCell>
                    <TableCell>{formatDate(lote.abierto_en)}</TableCell>
                    <TableCell>{formatDate(lote.cerrado_en)}</TableCell>
                    <TableCell>
                      {lote.numero_guia ? (
                        <Chip
                          icon={<LocalShippingIcon />}
                          label={lote.numero_guia}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      {lote.estado === 'cerrado' && (
                        <Tooltip title="Generar guía Acmasoft">
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<SendIcon />}
                            onClick={() => setGuiaDialog(lote.lote_id)}
                          >
                            Generar Guía
                          </Button>
                        </Tooltip>
                      )}
                      {lote.estado === 'enviado' && (
                        <CheckCircleIcon color="success" />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow key={`${lote.lote_id}-detail`}>
                    <TableCell colSpan={9} sx={{ py: 0 }}>
                      <Collapse in={expandedLote === lote.lote_id} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2, px: 2 }}>
                          {loadingDetail ? (
                            <CircularProgress size={24} />
                          ) : loteDetail && loteDetail.lote_id === lote.lote_id ? (
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Remito ID</TableCell>
                                  <TableCell>Estado</TableCell>
                                  <TableCell>Remitente</TableCell>
                                  <TableCell>Destinatario</TableCell>
                                  <TableCell>Tipo Carga</TableCell>
                                  <TableCell align="right">Bultos</TableCell>
                                  <TableCell align="right">Peso (kg)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {loteDetail.remitos.map((r) => {
                                  const datos = r.datos_validados ?? r.datos_ia;
                                  return (
                                    <TableRow key={r.remito_id}>
                                      <TableCell>
                                        <Typography variant="body2" fontFamily="monospace" fontSize={11}>
                                          {r.remito_id.slice(0, 8)}…
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Chip label={r.estado} size="small" />
                                      </TableCell>
                                      <TableCell>{datos?.remitente ?? r.remitente_normalizado ?? '—'}</TableCell>
                                      <TableCell>{datos?.destinatario ?? r.destinatario_normalizado ?? '—'}</TableCell>
                                      <TableCell>{datos?.tipo_carga ?? '—'}</TableCell>
                                      <TableCell align="right">{datos?.bultos ?? '—'}</TableCell>
                                      <TableCell align="right">{datos?.peso_kg ?? '—'}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          ) : (
                            <Typography color="text.secondary">Sin detalle</Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!guiaDialog} onClose={() => { setGuiaDialog(null); setGuiaResult(null); }}>
        <DialogTitle>
          {guiaResult ? 'Guía Generada' : 'Generar Guía Acmasoft'}
        </DialogTitle>
        <DialogContent>
          {guiaResult ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="success">Guía generada correctamente</Alert>
              <Typography><strong>Nº Guía:</strong> {guiaResult.numero_guia}</Typography>
              <Typography><strong>ID:</strong> {guiaResult.guia_id}</Typography>
              <Typography><strong>Fecha:</strong> {formatDate(guiaResult.fecha_emision)}</Typography>
              <Typography><strong>Remitos enviados:</strong> {guiaResult.remitos_enviados}</Typography>
            </Stack>
          ) : (
            <Typography sx={{ pt: 1 }}>
              ¿Confirmar la generación de guía para este lote? Se enviará la información a Acmasoft.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {guiaResult ? (
            <Button onClick={() => { setGuiaDialog(null); setGuiaResult(null); }}>
              Cerrar
            </Button>
          ) : (
            <>
              <Button onClick={() => setGuiaDialog(null)} disabled={generatingGuia}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                startIcon={generatingGuia ? <CircularProgress size={16} /> : <SendIcon />}
                onClick={() => guiaDialog && handleGenerarGuia(guiaDialog)}
                disabled={generatingGuia}
                sx={{ bgcolor: b2salesBlue }}
              >
                {generatingGuia ? 'Generando…' : 'Confirmar'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
