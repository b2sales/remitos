import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import QueueIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SendIcon from '@mui/icons-material/Send';
import WarningIcon from '@mui/icons-material/Warning';
import TimerIcon from '@mui/icons-material/Timer';
import { b2salesBlue, b2salesYellow, b2salesRed, b2salesPurple } from '@/theme';
import { statsApi, type DashboardStats } from '@/services/stats';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={600}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: `${color}15`,
              color,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.getDashboard()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (!stats) {
    return (
      <Box>
        <Typography color="error">Error al cargar estadísticas</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Pendientes de validación"
            value={stats.resumen.pendientes}
            icon={<QueueIcon />}
            color={b2salesYellow}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Validados"
            value={stats.resumen.validados}
            icon={<CheckCircleIcon />}
            color="#4CAF50"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Enviados a Acmasoft"
            value={stats.resumen.enviados}
            icon={<SendIcon />}
            color={b2salesBlue}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Errores"
            value={stats.resumen.errores}
            icon={<ErrorIcon />}
            color={b2salesRed}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total remitos"
            value={stats.resumen.total_remitos}
            icon={<TrendingUpIcon />}
            color={b2salesBlue}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Urgentes"
            value={stats.resumen.urgentes}
            icon={<WarningIcon />}
            color={b2salesRed}
            subtitle={`${stats.resumen.fuera_horario} fuera de horario`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="% Sin corrección"
            value={`${stats.calidad.pct_sin_correccion}%`}
            icon={<CheckCircleIcon />}
            color="#4CAF50"
            subtitle="Interpretación IA correcta"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Latencia promedio"
            value={`${stats.calidad.latencia_promedio_min} min`}
            icon={<TimerIcon />}
            color={b2salesPurple}
            subtitle="Escaneo → Validación"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Lotes
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Abiertos</Typography>
                  <Chip label={stats.lotes.abiertos} size="small" color="warning" />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Cerrados (pendientes envío)</Typography>
                  <Chip label={stats.lotes.cerrados} size="small" color="primary" />
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Enviados</Typography>
                  <Chip label={stats.lotes.enviados} size="small" color="success" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight={600}>Total</Typography>
                  <Typography variant="body2" fontWeight={600}>{stats.lotes.total}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Rendimiento por operador
              </Typography>
              {stats.operadores.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Sin datos de operadores aún
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Operador ID</TableCell>
                        <TableCell align="right">Remitos validados</TableCell>
                        <TableCell align="right">Campos corregidos</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.operadores
                        .sort((a, b) => b.remitos_validados - a.remitos_validados)
                        .map((op) => (
                          <TableRow key={op.operador_id}>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace" fontSize={11}>
                                {op.operador_id.slice(0, 8)}…
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{op.remitos_validados}</TableCell>
                            <TableCell align="right">{op.campos_corregidos}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {stats.top_remitentes_errores.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top remitentes con correcciones
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Remitente</TableCell>
                    <TableCell align="right">Correcciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.top_remitentes_errores.map((r) => (
                    <TableRow key={r.remitente}>
                      <TableCell>{r.remitente}</TableCell>
                      <TableCell align="right">{r.correcciones}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
