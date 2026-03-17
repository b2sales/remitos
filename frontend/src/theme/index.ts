import { createTheme, alpha } from '@mui/material/styles';

const b2salesBlue = '#0093C7';
const b2salesRed = '#E13F12';
const b2salesYellow = '#FFDD0E';
const b2salesPurple = '#8B2E8B';
const b2salesGray = '#6B6B6B';

const theme = createTheme({
  palette: {
    primary: {
      main: b2salesBlue,
      light: '#33A9D2',
      dark: '#006E96',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: b2salesRed,
      light: '#E76541',
      dark: '#A82C0D',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: b2salesYellow,
      light: '#FFE64B',
      dark: '#C9AE00',
      contrastText: '#1A1A1A',
    },
    error: {
      main: b2salesRed,
    },
    info: {
      main: b2salesBlue,
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',
      secondary: b2salesGray,
    },
    divider: alpha(b2salesGray, 0.15),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h4: {
      fontWeight: 500,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    subtitle1: {
      fontWeight: 500,
      color: b2salesGray,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          padding: '8px 20px',
        },
        containedPrimary: {
          boxShadow: `0 2px 8px ${alpha(b2salesBlue, 0.3)}`,
          '&:hover': {
            boxShadow: `0 4px 12px ${alpha(b2salesBlue, 0.4)}`,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: `0 1px 4px ${alpha('#000', 0.08)}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: `0 1px 4px ${alpha('#000', 0.06)}`,
          borderRadius: 12,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            backgroundColor: alpha(b2salesBlue, 0.04),
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          boxShadow: `2px 0 8px ${alpha('#000', 0.04)}`,
        },
      },
    },
  },
});

export { b2salesBlue, b2salesRed, b2salesYellow, b2salesPurple, b2salesGray };
export default theme;
