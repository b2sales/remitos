import { Box, Button, Container, Typography, Paper, Stack } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { b2salesGray } from '@/theme';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5F7FA 0%, #E8F4F8 100%)',
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Box
              component="img"
              src="/logo-full.jpg"
              alt="B2Sales"
              sx={{ width: 260, mb: 1 }}
            />

            <Typography variant="h5" fontWeight={500} color="text.primary">
              Sistema de Remitos
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
              Gestión y validación de remitos de transporte
            </Typography>

            <Button
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              onClick={onLogin}
              fullWidth
              sx={{ mt: 2, py: 1.5 }}
            >
              Iniciar sesión con Microsoft
            </Button>

            <Typography variant="caption" sx={{ color: b2salesGray, mt: 2 }}>
              Acceso exclusivo para personal autorizado
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
