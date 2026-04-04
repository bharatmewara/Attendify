import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
  const [perfHistory, setPerfHistory] = useState(null);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [incentiveRules, setIncentiveRules] = useState(null);
  const [salaryTiers, setSalaryTiers] = useState([]);
  
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

  const loadPerformanceSection = useCallback(async () => {
    const nowDate = new Date();
    const month = nowDate.getMonth() + 1;
    const yearNum = nowDate.getFullYear();

    try {
      const [perf, history] = await Promise.all([
        apiRequest(`/incentives/performance?month=${month}&year=${yearNum}`),
        apiRequest('/incentives/performance/history?months_back=6'),
      ]);
      setPerfInfo(perf || null);
      setPerfHistory(history || null);
      setPerfOfficeBlocked(false);
    } catch (perfError) {
      const msg = String(perfError?.message || '');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setPerfOfficeBlocked(true);
        setPerfInfo(null);
        setPerfHistory(null);
        setMySubmissions([]);
        return;
      }
      throw perfError;
    }

    try {
      const submissions = await apiRequest('/incentives/submissions');
      setMySubmissions(Array.isArray(submissions) ? submissions : []);
    } catch (subError) {
      const msg = String(subError?.message || '');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setMySubmissions([]);
        return;
      }
      setMySubmissions([]);
    }
  }, []);

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

        await loadPerformanceSection();
        try {
          const [rulesRes, tiersRes] = await Promise.all([
            apiRequest('/incentives/rules'),
            apiRequest('/incentives/targets/tiers'),
          ]);
          setIncentiveRules(rulesRes?.config || null);
          setSalaryTiers(Array.isArray(tiersRes) ? tiersRes : []);
        } catch {
          // not critical
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    };
    loadData();
  }, [loadPerformanceSection, user]);

  useEffect(() => {
    if (user?.role !== 'employee') return;
    const handler = () => {
      loadPerformanceSection().catch((error) => {
        setMessage({ type: 'error', text: error?.message || 'Failed to refresh performance analytics.' });
      });
    };
    window.addEventListener('incentives:updated', handler);
    return () => window.removeEventListener('incentives:updated', handler);
  }, [loadPerformanceSection, user?.role]);

  const perfSummary = perfInfo?.summary || null;
  const perfTarget = perfInfo?.target_sales_amount ? Number(perfInfo.target_sales_amount) : null;
  const perfSales = Number(perfSummary?.sales_total || 0);
  const perfIncentives = Number(perfSummary?.incentives_total || 0);
  const perfClients = Number(perfSummary?.clients_total || 0);
  const perfSms = Number(perfSummary?.sms_total || 0);
  const perfDetails = Array.isArray(perfInfo?.details) ? perfInfo.details : [];
  const perfPct = perfTarget ? (perfSales / perfTarget) * 100 : null;
  const perfLeft = perfTarget ? Math.max(0, perfTarget - perfSales) : null;
  const perfAvgSale = perfClients > 0 ? perfSales / perfClients : null;
  const perfEstClientsLeft =
    perfLeft !== null && perfAvgSale && perfAvgSale > 0 ? Math.max(0, Math.ceil(perfLeft / perfAvgSale)) : null;

  const nowMonth = useMemo(() => {
    const d = new Date();
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, []);
  const pendingThisMonth = useMemo(() => {
    const rows = Array.isArray(mySubmissions) ? mySubmissions : [];
    return rows.filter((r) => {
      if (String(r.status || '').toLowerCase() !== 'pending') return false;
      const dt = r.submitted_at ? new Date(r.submitted_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) return false;
      return (dt.getMonth() + 1) === nowMonth.month && dt.getFullYear() === nowMonth.year;
    });
  }, [mySubmissions, nowMonth.month, nowMonth.year]);
  const pendingIncentiveThisMonth = useMemo(
    () => pendingThisMonth.reduce((sum, r) => sum + Number(r.incentive_amount || 0), 0),
    [pendingThisMonth],
  );

  const salaryNow = perfInfo?.tier_applied?.target_total_salary !== null && perfInfo?.tier_applied?.target_total_salary !== undefined
    ? Number(perfInfo.tier_applied.target_total_salary)
    : null;
  const salaryAtTarget = perfInfo?.tier_at_target?.target_total_salary !== null && perfInfo?.tier_at_target?.target_total_salary !== undefined
    ? Number(perfInfo.tier_at_target.target_total_salary)
    : null;

  const historyGroups = Array.isArray(perfHistory?.groups) ? perfHistory.groups : [];
  const maxHistorySales = historyGroups.reduce((max, g) => Math.max(max, Number(g.summary?.sales_total || 0)), 0) || 0;
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
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Sales</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfSales.toLocaleString()}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Target</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfTarget ? perfTarget.toLocaleString() : 'Not set'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {perfLeft !== null ? `Left: ${perfLeft.toLocaleString()}` : ' '}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Approved Incentives</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfIncentives.toFixed(2)}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Pending Incentives</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{pendingIncentiveThisMonth.toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pendingThisMonth.length ? `Requests: ${pendingThisMonth.length}` : ' '}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">Clients</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfClients}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <Paper variant="outlined" sx={summaryCardSx}>
                    <Typography variant="caption" color="text.secondary">SMS Qty</Typography>
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>{perfSms.toLocaleString()}</Typography>
                    <Typography variant="caption" sx={{ visibility: 'hidden' }}>.</Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.25, height: '100%' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <CircularProgress
                          variant="determinate"
                          value={perfTarget ? Math.min(100, Math.max(0, perfPct || 0)) : 0}
                          size={84}
                          thickness={4.5}
                          color={perfPct >= 100 ? 'success' : perfPct >= 75 ? 'info' : 'warning'}
                        />
                        <Box
                          sx={{
                            top: 0,
                            left: 0,
                            bottom: 0,
                            right: 0,
                            position: 'absolute',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="subtitle1" fontWeight={900}>
                            {perfTarget ? `${Math.min(100, Math.round(perfPct || 0))}%` : '—'}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={900}>This Month Goal</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {perfTarget ? `Sales left: ${perfLeft !== null ? perfLeft.toLocaleString() : '—'}` : 'Target not set'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {perfEstClientsLeft !== null ? `Est. clients left: ${perfEstClientsLeft}` : ' '}
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider sx={{ my: 1.5 }} />
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Current tier salary</Typography>
                        <Typography variant="body2" fontWeight={800}>{salaryNow !== null ? salaryNow.toLocaleString() : '—'}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Salary on target</Typography>
                        <Typography variant="body2" fontWeight={800}>{salaryAtTarget !== null ? salaryAtTarget.toLocaleString() : '—'}</Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Paper variant="outlined" sx={{ borderRadius: 3, p: 2.25, height: '100%' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Box>
                        <Typography fontWeight={900}>Sales Trend</Typography>
                        <Typography variant="body2" color="text.secondary">Last 6 months (approved only)</Typography>
                      </Box>
                    </Stack>

                    {historyGroups.length ? (
                      <Stack spacing={1.25} sx={{ mt: 2 }}>
                        {historyGroups.slice(0, 6).map((g) => {
                          const label = `${String(g.month).padStart(2, '0')}/${g.year}`;
                          const value = Number(g.summary?.sales_total || 0);
                          const pct = maxHistorySales ? Math.round((value / maxHistorySales) * 100) : 0;
                          return (
                            <Box key={`${g.year}-${g.month}`}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
                                <Typography variant="body2" fontWeight={700}>{label}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {value.toLocaleString()} (Inc: {Number(g.summary?.incentives_total || 0).toFixed(2)})
                                </Typography>
                              </Stack>
                              <LinearProgress variant="determinate" value={pct} sx={{ height: 10, borderRadius: 999 }} />
                            </Box>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        No history available yet.
                      </Typography>
                    )}
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
                  <Table size="small" stickyHeader sx={{ minWidth: 1600 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Client</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">SMS Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Incentive</TableCell>
                        <TableCell>Mobile</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Panel User</TableCell>
                        <TableCell>Panel Pass</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {perfDetails.slice(0, 8).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell sx={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.client_name || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.product_name || '—'}</TableCell>
                          <TableCell align="right">{row.sms_quantity ?? '—'}</TableCell>
                          <TableCell align="right">{Number(row.price || 0).toLocaleString()}</TableCell>
                          <TableCell align="right">{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.client_mobile_1 || row.clientMobile1 || row.client_mobile1 || row.client_mobile_2 || row.clientMobile2 || row.client_mobile2
                              ? `${row.client_mobile_1 || row.clientMobile1 || row.client_mobile1 || ''}${(row.client_mobile_2 || row.clientMobile2 || row.client_mobile2) ? `, ${row.client_mobile_2 || row.clientMobile2 || row.client_mobile2}` : ''}`
                              : '—'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_email || row.clientEmail || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_username || row.clientPanelUsername || '—'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_password || row.clientPanelPassword || '—'}</TableCell>
                          <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString() : '—'}</TableCell>
                        </TableRow>
                      ))}
                      {perfDetails.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10}>
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

      {/* Incentive Rules */}
      {(incentiveRules || salaryTiers.length > 0) && !perfOfficeBlocked ? (
        <Card sx={{ ...shellCardSx, mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Incentive Rules</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Per-sale incentive by product &amp; quantity. Reach a Min Sales Total to unlock the corresponding salary tier.
            </Typography>

            {/* Product incentive rules */}
            {incentiveRules && Array.isArray(incentiveRules.products) ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: salaryTiers.length > 0 ? 3 : 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Quantity</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Incentive / Sale</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {incentiveRules.products.filter((p) => p.active !== false).flatMap((product) =>
                      (product.rules || []).map((rule, idx) => (
                        <TableRow key={`${product.name}-${idx}`} hover>
                          {idx === 0 ? (
                            <TableCell
                              rowSpan={product.rules.length}
                              sx={{ fontWeight: 700, verticalAlign: 'top', borderRight: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }}
                            >
                              {product.name}
                            </TableCell>
                          ) : null}
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {rule.min_qty != null || rule.max_qty != null
                              ? `${rule.min_qty != null ? Number(rule.min_qty).toLocaleString('en-IN') : '0'} – ${rule.max_qty != null ? Number(rule.max_qty).toLocaleString('en-IN') : '∞'}`
                              : rule.max_price != null
                              ? `Price ≤ ₹${Number(rule.max_price).toLocaleString('en-IN')}`
                              : 'Any'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', whiteSpace: 'nowrap' }}>
                            {rule.flat != null && rule.percent_of_price != null
                              ? `₹${rule.flat} + ${(rule.percent_of_price * 100).toFixed(0)}% of price`
                              : rule.flat != null
                              ? `₹${rule.flat}`
                              : rule.percent_of_price != null
                              ? `${(rule.percent_of_price * 100).toFixed(0)}% of price`
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}

            {/* Salary tier table */}
            {salaryTiers.length > 0 ? (
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Min Sales Total (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total Salary (₹)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="center">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {salaryTiers.map((tier, idx) => {
                      const minSales = Number(tier.min_sales_amount);
                      const isCurrent = perfInfo?.tier_applied != null &&
                        Number(perfInfo.tier_applied.min_sales_amount) === minSales;
                      const achieved = perfSales >= minSales;
                      return (
                        <TableRow
                          key={idx}
                          sx={{ bgcolor: isCurrent ? 'success.50' : 'inherit' }}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>₹{minSales.toLocaleString('en-IN')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: isCurrent ? 'success.main' : 'text.primary' }}>
                            ₹{Number(tier.target_total_salary).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell align="center">
                            {isCurrent ? (
                              <Chip size="small" label="Current Tier" color="success" />
                            ) : achieved ? (
                              <Chip size="small" label="Achieved" color="info" variant="outlined" />
                            ) : (
                              <Chip size="small" label={`₹${Math.max(0, minSales - perfSales).toLocaleString('en-IN')} away`} variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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

