import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import { remitosApi, type RemitoListItem } from '@/services/remitos';
import StatusChip from '@/components/StatusChip';

export default function QueuePage() {
  const navigate = useNavigate();
  const [remitos, setRemitos] = useState<RemitoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRemitos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await remitosApi.listPendientes();
      setRemitos(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar remitos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemitos();
  }, [fetchRemitos]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h5">
          Cola de validación
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchRemitos}
          disabled={loading}
        >
          Actualizar
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>ID</TableCell>
                <TableCell>Remitente</TableCell>
                <TableCell>Destinatario</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Escaneado</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : remitos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      No hay remitos pendientes de validación
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                remitos.map((r) => (
                  <TableRow
                    key={r.remito_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/validacion/${r.remito_id}`)}
                  >
                    <TableCell>
                      {r.es_urgente && (
                        <Chip
                          icon={<PriorityHighIcon />}
                          label="Urgente"
                          color="error"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                        {r.remito_id.slice(0, 8)}
                      </Typography>
                    </TableCell>
                    <TableCell>{r.remitente_normalizado ?? '—'}</TableCell>
                    <TableCell>{r.destinatario_normalizado ?? '—'}</TableCell>
                    <TableCell>
                      <StatusChip estado={r.estado} />
                    </TableCell>
                    <TableCell>{formatDate(r.escaneado_en)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Validar">
                        <IconButton
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/validacion/${r.remito_id}`);
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
