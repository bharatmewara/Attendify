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
import { ArrowForward, Bolt, EventAvailable, TrendingUp } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const shellCardSx = {
  borderRadius: 3,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [nearHoliday, setNearHoliday] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [perfInfo, setPerfInfo] = useState(null);
  const [perfOfficeBlocked, setPerfOfficeBlocked] = useState(false);
  
  const fetchTodayAttendance = async () => {
    try {
      return await apiRequest('/attendance/today');
    } catch (error) {
      if (String(error?.message || '').includes('404')) {
        return apiRequest('/attendance/today-status');
      }
      throw error;
    }
  };

  useEffect(() => {
    if (user?.role !== 'employee') {
      return;
    }
    const loadData = async () => {
      try {
        const [attendanceData, balanceData] = await Promise.all([
          fetchTodayAttendance(),
          apiRequest('/leave/balance'),
        ]);
        setTodayAttendance(attendanceData);
        setLeaveBalance(balanceData);
        const year = new Date().getFullYear();
        const holidays = await apiRequest(`/holidays?year=${year}`);
        const now = new Date();
        const upcoming = (holidays || [])
          .filter((h) => {
            const d = new Date(h.holiday_date);
            const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
            return diff >= 0 && diff <= 30;
          })
          .slice(0, 5);
        setUpcomingHolidays(upcoming);
        const nearest = (holidays || [])
          .map((h) => {
            const d = new Date(h.holiday_date);
            const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
            return { ...h, days_left: diff };
          })
          .filter((h) => h.days_left >= 0 && h.days_left <= 4)
          .sort((a, b) => a.days_left - b.days_left)[0] || null;
        setNearHoliday(nearest);

        try {
          const nowDate = new Date();
          const month = nowDate.getMonth() + 1;
          const yearNum = nowDate.getFullYear();
          const perf = await apiRequest(`/incentives/performance?month=${month}&year=${yearNum}`);
          setPerfInfo(perf || null);
          setPerfOfficeBlocked(false);
        } catch (perfError) {
          const msg = String(perfError?.message || '');
          if (msg.toLowerCase().includes('office') || msg.includes('403')) {
            setPerfOfficeBlocked(true);
            setPerfInfo(null);
          }
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    };
    loadData();
  }, [user]);

  const perfSummary = perfInfo?.summary || null;
  const perfTarget = perfInfo?.target_sales_amount ? Number(perfInfo.target_sales_amount) : null;
  const perfSales = Number(perfSummary?.sales_total || 0);
  const perfPct = perfTarget ? (perfSales / perfTarget) * 100 : null;
  const perfNudge =
    perfPct === null ? '' :
      perfPct >= 100 ? 'Target completed. Great work!' :
        perfPct >= 90 ? 'Just a little push more left - your reward is waiting.' :
          perfPct >= 75 ? 'Almost there. Keep it up, you can do it.' :
            perfPct >= 50 ? 'Good progress. Keep pushing towards your target.' :
              'Start strong - every client counts.';

  const handlePunchIn = async () => {
    try {
      await apiRequest('/attendance/punch-in', { method: 'POST', body: { location: 'Web Portal' } });
      setMessage({ type: 'success', text: 'Punch in recorded' });
      const data = await fetchTodayAttendance();
      setTodayAttendance(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handlePunchOut = async () => {
    try {
      await apiRequest('/attendance/punch-out', { method: 'POST', body: { location: 'Web Portal' } });
      setMessage({ type: 'success', text: 'Punch out recorded' });
      const data = await fetchTodayAttendance();
      setTodayAttendance(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const totalRemaining = leaveBalance.reduce((sum, b) => sum + Number(b.remaining_days || 0), 0);

  if (user?.role !== 'employee') {
    return (
      <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4">Welcome, {user?.first_name || 'Admin'}.</Typography>
        <Typography>This is the employee dashboard. As an admin, you can manage employees from the "Employees" section.</Typography>
      </Box>
    )
  }

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
        {upcomingHolidays.length > 0 ? (
          <Alert severity="info" sx={{ mt: 1.5, textAlign: 'left' }}>
            <strong>Upcoming Holidays:</strong>{' '}
            {upcomingHolidays.map((h, idx) => (
              <span key={h.id}>
                {idx > 0 ? ', ' : ''}
                {h.name} ({new Date(h.holiday_date).toLocaleDateString()})
              </span>
            ))}
          </Alert>
        ) : null}
        {perfOfficeBlocked ? (
          <Alert severity="warning" sx={{ mt: 1.5, textAlign: 'left' }}>
            Sales, targets, and incentive details are available only from office-approved network.
          </Alert>
        ) : perfTarget ? (
          <Alert severity={perfPct >= 100 ? 'success' : perfPct >= 75 ? 'info' : 'warning'} sx={{ mt: 1.5, textAlign: 'left' }}>
            <strong>Target:</strong> {perfTarget.toLocaleString()} | <strong>Sales:</strong> {perfSales.toLocaleString()}
            {perfNudge ? ` - ${perfNudge}` : ''}
          </Alert>
        ) : null}
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
                  <Button fullWidth variant="outlined" onClick={() => navigate('/app/performance')} startIcon={<TrendingUp />}>
                    My Performance
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

