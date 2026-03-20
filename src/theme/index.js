import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#6366F1', contrastText: '#fff' }, // Indigo-600
    background: { default: '#F9FAFB', paper: '#FFFFFF' },
    text: { primary: '#111827', secondary: '#6B7280' },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    h4: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { boxShadow: '0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px rgba(0,0,0,0.06)' },
      },
    },
  },
});

export default theme;