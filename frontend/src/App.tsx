import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '@/theme';
import { AuthProvider } from '@/auth/AuthProvider';
import MainLayout from '@/layouts/MainLayout';
import DashboardPage from '@/pages/DashboardPage';
import QueuePage from '@/pages/QueuePage';
import ValidationPage from '@/pages/ValidationPage';
import UploadPage from '@/pages/UploadPage';
import LotesPage from '@/pages/LotesPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/cargar" element={<UploadPage />} />
              <Route path="/validacion" element={<QueuePage />} />
              <Route path="/validacion/:remitoId" element={<ValidationPage />} />
              <Route path="/lotes" element={<LotesPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
