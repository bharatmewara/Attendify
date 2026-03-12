import { Alert, Container } from '@mui/material';
import { useParams } from 'react-router-dom';
import { moduleCatalog } from '../../config/saas';
import { useAuth } from '../../context/AuthContext';
import EmployeeManagement from '../CompanyAdmin/EmployeeManagement';
import LeaveManagement from '../CompanyAdmin/LeaveManagement';
import ShiftManagement from '../CompanyAdmin/ShiftManagement';
import PayrollManagement from '../CompanyAdmin/PayrollManagement';
import HRDocuments from '../CompanyAdmin/HRDocuments';
import AttendanceManagement from '../CompanyAdmin/AttendanceManagement';
import EmployeeDashboard from '../Employee/Dashboard';

const ModuleDetailsPage = () => {
  const { moduleKey } = useParams();
  const { user } = useAuth();
  const module = moduleCatalog.find((item) => item.key === moduleKey);

  if (!module) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">Module not found.</Alert>
      </Container>
    );
  }

  if (user?.role === 'employee') {
    if (moduleKey === 'attendance' || moduleKey === 'leave' || moduleKey === 'payroll' || moduleKey === 'documents') {
      return <EmployeeDashboard />;
    }
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="warning">This module is not available for employee role.</Alert>
      </Container>
    );
  }

  if (moduleKey === 'employees') {
    return <EmployeeManagement />;
  }
  if (moduleKey === 'leave') {
    return <LeaveManagement />;
  }
  if (moduleKey === 'shift') {
    return <ShiftManagement />;
  }
  if (moduleKey === 'payroll') {
    return <PayrollManagement />;
  }
  if (moduleKey === 'documents') {
    return <HRDocuments />;
  }
  if (moduleKey === 'attendance') {
    return <AttendanceManagement />;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Alert severity="info">{module.name} page is being prepared.</Alert>
    </Container>
  );
};

export default ModuleDetailsPage;
