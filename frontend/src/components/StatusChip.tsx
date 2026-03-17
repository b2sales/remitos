import { Chip, type ChipProps } from '@mui/material';
import type { RemitoEstado } from '@/services/remitos';

const statusConfig: Record<
  RemitoEstado,
  { label: string; color: ChipProps['color'] }
> = {
  procesando_ocr: { label: 'OCR en curso', color: 'info' },
  error_ocr: { label: 'Error OCR', color: 'error' },
  pendiente_ia: { label: 'Procesando IA', color: 'info' },
  error_ia: { label: 'Error IA', color: 'error' },
  pendiente_validacion: { label: 'Pendiente', color: 'warning' },
  validado: { label: 'Validado', color: 'success' },
  enviado_acmasoft: { label: 'Enviado', color: 'success' },
  error_acmasoft: { label: 'Error envío', color: 'error' },
};

interface StatusChipProps {
  estado: RemitoEstado;
  size?: ChipProps['size'];
}

export default function StatusChip({ estado, size = 'small' }: StatusChipProps) {
  const config = statusConfig[estado] ?? { label: estado, color: 'default' as const };
  return <Chip label={config.label} color={config.color} size={size} variant="filled" />;
}
