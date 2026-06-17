import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import Login from './pages/Auth/Login';
import MainLayout from './layout/MainLayout';
import AuthLayout from './layout/AuthLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Dashboards
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import CompanyAdminDashboard from './pages/CompanyAdmin/Dashboard';
import EmployeeDashboard from './pages/Employee/Dashboard';
import EmployeeAttendance from './pages/Employee/Attendance';
import EmployeeManagement from './pages/CompanyAdmin/EmployeeManagement';
import LeaveManagement from './pages/CompanyAdmin/LeaveManagement';
import AttendanceManagement from './pages/CompanyAdmin/AttendanceManagement';
import AttendanceRegularization from './pages/CompanyAdmin/AttendanceRegularization';
import ShiftManagement from './pages/CompanyAdmin/ShiftManagement';
import HRDocuments from './pages/CompanyAdmin/HRDocuments';
import HolidayManagement from './pages/CompanyAdmin/HolidayManagement';
import IncentivesManagement from './pages/CompanyAdmin/Incentives';
import ClientsManagement from './pages/CompanyAdmin/Clients';
import EmployeeIncentives from './pages/Employee/Incentives';
import EmployeeDocuments from './pages/Employee/Documents';
import EmployeePerformance from './pages/Employee/Performance';
import EmployeePerformanceDashboard from './pages/CompanyAdmin/EmployeePerformanceDashboard';
import MyClients from './pages/Employee/MyClients';


// Super Admin Pages
import Companies from './pages/SuperAdmin/Companies';
import Plans from './pages/SuperAdmin/Plans';
import Analytics from './pages/SuperAdmin/Analytics';
import AdminSettings from './pages/SuperAdmin/AdminSettings';

// ── NEW Payroll Pages ──────────────────────────────────────────
import PayrollDashboard    from './pages/CompanyAdmin/payroll/PayrollDashboard';
import PayrollSettings     from './pages/CompanyAdmin/payroll/PayrollSettings';
import SalaryComponents    from './pages/CompanyAdmin/payroll/SalaryComponents';
import SalaryStructures    from './pages/CompanyAdmin/payroll/SalaryStructures';
import SalaryAssignment    from './pages/CompanyAdmin/payroll/SalaryAssignment';
import PayrollRun          from './pages/CompanyAdmin/payroll/PayrollRun';
import PayrollHistory      from './pages/CompanyAdmin/payroll/PayrollHistory';
import PayslipViewer       from './pages/CompanyAdmin/payroll/PayslipViewer';
import PayrollAuditLog     from './pages/CompanyAdmin/payroll/PayrollAuditLog';

// ── Employee Payroll ───────────────────────────────────────────
import MyPayslips from './pages/Employee/payroll/MyPayslips';

function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === 'super_admin')   return <SuperAdminDashboard />;
  if (user?.role === 'company_admin') return <CompanyAdminDashboard />;
  if (user?.role === 'employee')      return <EmployeeDashboard />;
  return <Navigate to="/auth/login" replace />;
}

function AttendanceRouter() {
  const { user } = useAuth();
  if (user?.role === 'employee') return <EmployeeAttendance />;
  return <AttendanceManagement />;
}

function IncentiveRouter() {
  const { user } = useAuth();
  if (user?.role === 'employee') return <EmployeeIncentives />;
  return <IncentivesManagement />;
}

function DocumentsRouter() {
  const { user } = useAuth();
  if (user?.role === 'employee') return <EmployeeDocuments />;
  return <HRDocuments />;
}

function PayrollRouter() {
  const { user } = useAuth();
  if (user?.role === 'employee') return <MyPayslips />;
  return <PayrollDashboard />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/auth" element={<AuthLayout />}>
            <Route path="login" element={<Login />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<MainLayout />}>
              <Route path="dashboard"  element={<DashboardRouter />} />
              <Route path="companies"  element={<Companies />} />
              <Route path="plans"      element={<Plans />} />
              <Route path="analytics"  element={<Analytics />} />
              <Route path="settings"   element={<AdminSettings />} />
              <Route path="employees"  element={<EmployeeManagement />} />
              <Route path="employees/:employeeId/performance" element={<EmployeePerformanceDashboard />} />
              <Route path="attendance"    element={<AttendanceRouter />} />
              <Route path="attendance-er" element={<AttendanceRegularization />} />
              <Route path="leave"         element={<LeaveManagement />} />
              <Route path="shifts"        element={<ShiftManagement />} />
              <Route path="incentives"    element={<IncentiveRouter />} />
              <Route path="clients"       element={<ClientsManagement />} />
              <Route path="my-clients"    element={<MyClients />} />
              <Route path="performance"   element={<EmployeePerformance />} />
              <Route path="documents"     element={<DocumentsRouter />} />
              <Route path="holidays"      element={<HolidayManagement />} />


              {/* ── Payroll Routes ─────────────────────────────── */}
              <Route path="payroll" element={<PayrollRouter />} />
              <Route path="payroll/settings"    element={<PayrollSettings />} />
              <Route path="payroll/components"  element={<SalaryComponents />} />
              <Route path="payroll/templates"   element={<SalaryStructures />} />
              <Route path="payroll/assignments" element={<SalaryAssignment />} />
              <Route path="payroll/run/:id"     element={<PayrollRun />} />
              <Route path="payroll/history"     element={<PayrollHistory />} />
              <Route path="payroll/payslip/:id" element={<PayslipViewer />} />
              <Route path="payroll/audit"       element={<PayrollAuditLog />} />

              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
