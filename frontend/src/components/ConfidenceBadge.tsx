import { Tooltip, Box } from '@mui/material';
import { b2salesRed, b2salesYellow } from '@/theme';

interface ConfidenceBadgeProps {
  value: number;
  field: string;
}

export default function ConfidenceBadge({ value, field }: ConfidenceBadgeProps) {
  const pct = Math.round(value * 100);
  let color: string;
  let label: string;

  if (pct >= 80) {
    color = '#4CAF50';
    label = 'Alta';
  } else if (pct >= 50) {
    color = b2salesYellow;
    label = 'Media';
  } else {
    color = b2salesRed;
    label = 'Baja';
  }

  return (
    <Tooltip title={`Confianza ${field}: ${pct}% (${label})`}>
      <Box
        sx={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          ml: 0.5,
          cursor: 'help',
        }}
      />
    </Tooltip>
  );
}
