import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ArrowForward, CheckCircle, EventAvailable, Groups2, HighlightOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';

const shellCardSx = {
  borderRadius: 5,
  border: '1px solid rgba(99, 102, 241, 0.12)',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
};

const statCardSx = {
  ...shellCardSx,
  height: '100%',
  background: 'linear-gradient(135deg, #ffffff 0%, #f6f7ff 100%)',
};

export default function CompanyAdminDashboard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const [empSummaryData, attendanceData, leaveSummaryData, employeesData, leaveData] = await Promise.all([
          apiRequest('/employees/summary'),
          apiRequest('/attendance/summary?date=today'),
          apiRequest('/leave/summary'),
          apiRequest('/employees'),
          apiRequest('/leave/requests?status=pending'),
        ]);
        if (isMounted) {
          setEmployeeSummary(empSummaryData);
          setAttendance(attendanceData);
          setLeaveSummary(leaveSummaryData);
          setEmployees(Array.isArray(employeesData) ? employeesData : []);
          setLeaveRequests(Array.isArray(leaveData) ? leaveData : []);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading company dashboard:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to load dashboard data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, []);

  const statCards = useMemo(
    () => [
      {
        title: 'Total Employees',
        value: employeeSummary ? employeeSummary.active_employees : (loading ? '...' : 0),
        helper: `${employeeSummary?.total_employees || 0} total registered (${employeeSummary?.inactive_employees || 0} inactive)`,
        icon: <Groups2 sx={{ fontSize: 34 }} />,
        color: '#2563EB',
      },
      {
        title: 'Present Today',
        value: attendance ? attendance.present_count : (loading ? '...' : 0),
        helper: attendance ? `${attendance.attendance_percentage}% daily attendance` : 'Employees marked present',
        icon: <CheckCircle sx={{ fontSize: 34 }} />,
        color: '#15803D',
      },
      {
        title: 'Absent Today',
        value: attendance ? attendance.absent_count : (loading ? '...' : 0),
        helper: attendance?.late_count ? `${attendance.late_count} late arrivals today` : 'Attendance gaps to review',
        icon: <HighlightOff sx={{ fontSize: 34 }} />,
        color: '#DC2626',
      },
      {
        title: 'Pending Leaves',
        value: leaveSummary ? leaveSummary.pending_count : (loading ? '...' : 0),
        helper: leaveSummary ? `${leaveSummary.approved_count} approved this year` : 'Requests waiting for action',
        icon: <EventAvailable sx={{ fontSize: 34 }} />,
        color: '#EA580C',
      },
    ],
    [employeeSummary, attendance, leaveSummary, loading],
  );

  const recentEmployees = employees.slice(0, 5);
  const pendingLeaves = leaveRequests.slice(0, 5);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Card
          sx={{
            ...shellCardSx,
            mb: 3,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f172a 0%, #312e81 55%, #4f46e5 100%)',
            color: '#fff',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                  Company Dashboard
                </Typography>
                <Typography sx={{ maxWidth: 620, color: 'rgba(255,255,255,0.78)' }}>
                  Monitor daily attendance, new employees, and pending approvals from one clean operational view.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  onClick={() => navigate('/app/leave')}
                  sx={{ bgcolor: '#fff', color: '#312e81', '&:hover': { bgcolor: '#eef2ff' } }}
                >
                  Review Leaves
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate('/app/employees')}
                  sx={{ bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' } }}
                >
                  Add Employee
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {statCards.map((stat) => (
            <Grid item xs={12} sm={6} lg={3} key={stat.title}>
              <Card sx={statCardSx}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography color="text.secondary" sx={{ mb: 1 }}>
                        {stat.title}
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                        {stat.helper}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 3,
                        display: 'grid',
                        placeItems: 'center',
                        color: stat.color,
                        bgcolor: `${stat.color}14`,
                        flexShrink: 0,
                      }}
                    >
                      {stat.icon}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2.5}>
          <Grid item xs={12} xl={7}>
            <Card sx={{ ...shellCardSx, height: '100%' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2.25, borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Recent Employees
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Latest employee records created in the company.
                      </Typography>
                    </Box>
                    <Button endIcon={<ArrowForward />} onClick={() => navigate('/app/employees')}>
                      Open Employees
                    </Button>
                  </Stack>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentEmployees.length ? (
                        recentEmployees.map((emp) => (
                          <TableRow key={emp.id} hover>
                            <TableCell>{`${emp.first_name} ${emp.last_name}`}</TableCell>
                            <TableCell>{emp.employee_code}</TableCell>
                            <TableCell>{emp.email}</TableCell>
                            <TableCell>
                              <Chip
                                label={emp.is_active ? 'Active' : 'Inactive'}
                                color={emp.is_active ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                            No employees found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} xl={5}>
            <Card sx={{ ...shellCardSx, height: '100%' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2.25, borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Pending Leave Requests
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Quick review queue for current leave approvals.
                      </Typography>
                    </Box>
                    <Button endIcon={<ArrowForward />} onClick={() => navigate('/app/leave')}>
                      Open Leave
                    </Button>
                  </Stack>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Days</TableCell>
                        <TableCell align="right">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingLeaves.length ? (
                        pendingLeaves.map((leave) => (
                          <TableRow key={leave.id} hover>
                            <TableCell>{`${leave.first_name} ${leave.last_name}`}</TableCell>
                            <TableCell>{leave.leave_type_name}</TableCell>
                            <TableCell>{leave.total_days}</TableCell>
                            <TableCell align="right">
                              <Button size="small" variant="outlined" onClick={() => navigate('/app/leave')}>
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                            No pending leave requests.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
