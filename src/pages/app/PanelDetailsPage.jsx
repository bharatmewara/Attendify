import { Alert, Box, Container } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SuperAdminDashboard from '../SuperAdmin/Dashboard';
import CompanyAdminDashboard from '../CompanyAdmin/Dashboard';
import EmployeeDashboard from '../Employee/Dashboard';

const PanelDetailsPage = () => {
  const { panelKey } = useParams();
  const { user } = useAuth();

  if (panelKey === 'super-admin') {
    if (user?.role !== 'super_admin') {
      return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Alert severity="warning">Only Super Admin can access this panel.</Alert>
        </Container>
      );
    }
    return (
      <Box sx={{ p: 3 }}>
        <SuperAdminDashboard />
      </Box>
    );
  }

  if (panelKey === 'company-admin') {
    return user?.role === 'company_admin' ? (
      <CompanyAdminDashboard />
    ) : (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="warning">Only Company Admin can access this panel.</Alert>
      </Container>
    );
  }

  if (panelKey === 'employee') {
    return user?.role === 'employee' ? (
      <EmployeeDashboard />
    ) : (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="warning">Only Employee role can access this panel.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Alert severity="error">Panel not found.</Alert>
    </Container>
  );
};

export default PanelDetailsPage;
