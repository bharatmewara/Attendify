import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
  Snackbar,
} from '@mui/material';
import { AccessTime, EventAvailable, Bolt, ArrowForward } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const shellCardSx = {
  borderRadius: 3,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [attendanceData, balanceData] = await Promise.all([
          apiRequest('/attendance/today'),
          apiRequest('/leave/balance'),
        ]);
        setTodayAttendance(attendanceData);
        setLeaveBalance(balanceData);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    };
    loadData();
  }, []);

  const handlePunchIn = async () => {
    try {
      await apiRequest('/attendance/punch-in', { method: 'POST', body: { location: 'Web Portal' } });
      setMessage({ type: 'success', text: 'Punch in recorded' });
      const data = await apiRequest('/attendance/today');
      setTodayAttendance(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handlePunchOut = async () => {
    try {
      await apiRequest('/attendance/punch-out', { method: 'POST', body: { location: 'Web Portal' } });
      setMessage({ type: 'success', text: 'Punch out recorded' });
      const data = await apiRequest('/attendance/today');
      setTodayAttendance(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const totalRemaining = leaveBalance.reduce((sum, b) => sum + Number(b.remaining_days || 0), 0);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Snackbar 
        open={Boolean(message.text)} 
        autoHideDuration={6000} 
        onClose={() => setMessage({})}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity={message.type || 'info'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message.text}
        </Alert>
      </Snackbar>

      {/* Hero Punch Section */}
      <Card sx={{ ...shellCardSx, mb: 4, p: 4, textAlign: 'center', bgcolor: 'gradient1.main' || '#f0f9ff' }}>
        <Typography variant="h3" sx={{ mb: 1, fontWeight: 700, color: 'primary.main' }}>
          Good day!
        </Typography>
        <Typography sx={{ mb: 4, color: 'text.secondary' }}>
          Today's Status: {todayAttendance?.status || 'No record'}
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="center" sx={{ mb: 3 }}>
          <Paper sx={{ p: 3, minWidth: 200, borderRadius: 3, bgcolor: todayAttendance?.punch_in_time ? 'grey.100' : 'success.50' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Punch In</Typography>
            <Typography sx={{ mb: 2 }}>{todayAttendance?.punch_in_time ? new Date(todayAttendance.punch_in_time).toLocaleTimeString() : 'Pending'}</Typography>
            <Button fullWidth variant="contained" color="success" disabled={Boolean(todayAttendance?.punch_in_time)} onClick={handlePunchIn}>
              Punch In Now
            </Button>
          </Paper>
          <Paper sx={{ p: 3, minWidth: 200, borderRadius: 3, bgcolor: todayAttendance?.punch_out_time ? 'grey.100' : 'error.50' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Punch Out</Typography>
            <Typography sx={{ mb: 2 }}>{todayAttendance?.punch_out_time ? new Date(todayAttendance.punch_out_time).toLocaleTimeString() : 'Pending'}</Typography>
            <Button fullWidth variant="contained" color="error" disabled={!todayAttendance?.punch_in_time || Boolean(todayAttendance?.punch_out_time)} onClick={handlePunchOut}>
              Punch Out Now
            </Button>
          </Paper>
        </Stack>
      </Card>

      {/* Leave Balance */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card sx={shellCardSx}>
            <CardContent sx={{ p: 4 }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'success.100', display: 'grid', placeItems: 'center' }}>
                  <EventAvailable sx={{ fontSize: 28, color: 'success.main' }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>Leave Balance</Typography>
                  <Typography color="text.secondary">Total remaining days across all leave types</Typography>
                </Box>
              </Stack>
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={5} lg={4}>
                  <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'success.50', borderRadius: 3, border: '1px dashed', borderColor: 'success.200' }}>
                    <Typography variant="h1" sx={{ fontWeight: 800, color: 'success.main', lineHeight: 1, mb: 1 }}>{totalRemaining}</Typography>
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>Remaining Days</Typography>
                    <Button variant="outlined" color="success" sx={{ mt: 3, borderRadius: 2 }} onClick={() => navigate('/app/leave')} endIcon={<ArrowForward />}>
                      View All Balances
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={7} lg={8}>
                  {leaveBalance.length > 0 ? (
                    <Stack spacing={2}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Top Balances</Typography>
                      {leaveBalance.slice(0, 3).map((balance) => (
                        <Paper key={balance.id} variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fafafa' }}>
                          <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{balance.leave_type_name}</Typography>
                          <Chip label={`${balance.remaining_days} days`} color="success" size="small" sx={{ fontWeight: 700, borderRadius: 2 }} />
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 3, p: 4 }}>
                      <Typography color="text.secondary" sx={{ fontWeight: 500 }}>No specific leave balances found.</Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            <Card sx={shellCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Quick Actions</Typography>
                <Stack spacing={2}>
                  <Button fullWidth variant="contained" onClick={() => navigate('/app/attendance-er')} startIcon={<Bolt />}>
                    Raise ER Request
                  </Button>
                  <Button fullWidth variant="outlined" onClick={() => navigate('/app/leave')} startIcon={<EventAvailable />}>
                    Apply for Leave
                  </Button>
                </Stack>
              </CardContent>
            </Card>
            <Card sx={shellCardSx}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Recent Payslips</Typography>
                <Stack spacing={1.5}>
                  <Paper sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 500, mb: 0.5 }}>No recent payslips</Typography>
                    <Typography variant="caption" color="text.secondary">Payroll section coming soon</Typography>
                  </Paper>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Simple recent items - optional tabbed view if needed */}
      <Card sx={shellCardSx}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 4, pt: 3, pb: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Recent Activity</Typography>
            <Typography color="text.secondary">Your latest updates at a glance</Typography>
          </Box>
          <Stack spacing={2} sx={{ px: 4, pb: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">No recent activity</Typography>
            </Paper>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
