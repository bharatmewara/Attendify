import { Box, Container, Stack, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';

const AuthLayout = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={800}>
            Attendify Pro
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enterprise Workforce SaaS
          </Typography>
        </Stack>
      </Container>
      <Outlet />
    </Box>
  );
};

export default AuthLayout;
