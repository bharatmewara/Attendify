import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
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
  Snackbar,
} from '@mui/material';
import { ArrowForward, Bolt, EventAvailable, TrendingUp } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const shellCardSx = {
  borderRadius: 3,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

const summaryCardSx = {
  p: 2,
  borderRadius: 3,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
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
  const perfIncentives = Number(perfSummary?.incentives_total || 0);
  const perfClients = Number(perfSummary?.clients_total || 0);
  const perfSms = Number(perfSummary?.sms_total || 0);
  const perfDetails = Array.isArray(perfInfo?.details) ? perfInfo.details : [];
  const perfPct = perfTarget ? (perfSales / perfTarget) * 100 : null;
  const perfLeft = perfTarget ? Math.max(0, perfTarget - perfSales) : null;
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
      </Card>

      {/* Performance Analytics */}
      <Card sx={{ ...shellCardSx, mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Performance Analytics</Typography>
              <Typography color="text.secondary">
                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate('/app/performance')} startIcon={<TrendingUp />} sx={{ borderRadius: 2 }}>
              View Details
            </Button>
          </Stack>

          {perfOfficeBlocked ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Sales, targets, and incentive details are available only from office-approved network.
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 2 }}>
              {perfTarget ? (
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary">Target Progress</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {Math.min(100, Math.round(perfPct || 0))}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, perfPct || 0))}
                    sx={{ height: 10, borderRadius: 999 }}
                    color={perfPct >= 100 ? 'success' : perfPct >= 75 ? 'info' : 'warning'}
                  />
                </Box>
              ) : (
                <Alert severity="info">
                  Ask your admin to set your monthly target to see progress % here.
                </Alert>
              )}

              <Grid container spacing={2} alignItems="stretch">
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Sales</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfSales.toLocaleString()}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Target</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfTarget ? perfTarget.toLocaleString() : 'Not set'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {perfLeft !== null ? `Left: ${perfLeft.toLocaleString()}` : ' '}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Clients</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfClients}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">SMS Qty</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfSms.toLocaleString()}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Paper variant="outlined" sx={{ borderRadius: 3 }}>
                <Box sx={{ p: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography fontWeight={800}>Approved Sales (This Month)</Typography>
                    <Chip size="small" label={`Incentives: ${perfIncentives.toFixed(2)}`} color="success" />
                  </Stack>
                </Box>
                <Divider />
                <TableContainer sx={{ maxHeight: 320 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Client</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Incentive</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {perfDetails.slice(0, 8).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.client_name || '—'}</TableCell>
                          <TableCell>{row.product_name || '—'}</TableCell>
                          <TableCell align="right">{Number(row.price || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                          <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString() : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {perfDetails.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Typography variant="body2" color="text.secondary">No approved sales found for this month.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {perfNudge ? (
                <Alert severity={perfPct >= 100 ? 'success' : perfPct >= 75 ? 'info' : 'warning'}>
                  {perfNudge}
                </Alert>
              ) : null}
            </Stack>
          )}
        </CardContent>
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

