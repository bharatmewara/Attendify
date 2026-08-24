import { useEffect, useState, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, CircularProgress, Alert, Skeleton,
  LinearProgress, Avatar, Divider, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
  PlayArrow, CheckCircle, AccountBalance, Schedule,
  Add, TrendingUp, Groups, PieChart, ArrowForward,
  Refresh, Warning, MonetizationOn,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const currency = (v) =>
  `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      color: '#6B7280', bg: '#F3F4F6' },
  processing: { label: 'Processing', color: '#2563EB', bg: '#EFF6FF' },
  approved:   { label: 'Approved',   color: '#059669', bg: '#ECFDF5' },
  paid:       { label: 'Paid',       color: '#0D9488', bg: '#F0FDFA' },
  cancelled:  { label: 'Cancelled',  color: '#DC2626', bg: '#FEF2F2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1.5, py: 0.5, borderRadius: 99, fontSize: '0.72rem', fontWeight: 600,
      color: cfg.color, bgcolor: cfg.bg,
    }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
      {cfg.label}
    </Box>
  );
}

function KpiCard({ label, value, icon, color, loading, sublabel }) {
  return (
    <Card sx={{ borderRadius: 3, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        bgcolor: `${color}18`,
      }} />
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar sx={{ bgcolor: `${color}18`, color, width: 44, height: 44 }}>
            {icon}
          </Avatar>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>{label}</Typography>
        </Box>
        {loading ? (
          <Skeleton variant="text" width="60%" height={40} />
        ) : (
          <Typography variant="h5" fontWeight={800} sx={{ color: '#0F172A' }}>{value}</Typography>
        )}
        {sublabel && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {sublabel}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function PayrollDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cyclesData, settingsData] = await Promise.all([
        apiRequest('/payroll/cycles'),
        apiRequest('/payroll/settings').catch(() => null),
      ]);
      setCycles(cyclesData || []);
      setSettings(settingsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateCycle = async () => {
    setCreating(true);
    try {
      const cycle = await apiRequest('/payroll/cycles', {
        method: 'POST',
        body: { cycle_month: selectedMonth, cycle_year: selectedYear },
      });
      navigate(`/app/payroll/run/${cycle.id}`);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  };

  // Computed stats
  const currentCycle = cycles.find(c => c.cycle_month === currentMonth && c.cycle_year === currentYear);
  const paidCycles   = cycles.filter(c => c.status === 'paid');
  const totalNetPaid = paidCycles.reduce((s, c) => s + Number(c.total_net_salary || 0), 0);

  const recentCycles = cycles.slice(0, 6);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
            Payroll Dashboard
          </Typography>
          <Typography color="text.secondary">
            Manage salary structures, run payroll cycles, and generate payslips
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Refresh />} onClick={loadData}>Refresh</Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenCreateDialog(true)}
            sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
          >
            New Cycle
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Total Cycles"
            value={loading ? '—' : cycles.length}
            icon={<Schedule />}
            color="#6366F1"
            loading={loading}
            sublabel="All time"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Paid Out (All Time)"
            value={loading ? '—' : currency(totalNetPaid)}
            icon={<AccountBalance />}
            color="#0D9488"
            loading={loading}
            sublabel={`${paidCycles.length} cycles paid`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Current Month"
            value={currentCycle ? <StatusBadge status={currentCycle.status} /> : 'Not Started'}
            icon={<MonetizationOn />}
            color="#F59E0B"
            loading={loading}
            sublabel={`${MONTH_NAMES[currentMonth - 1]} ${currentYear}`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Working Days Rule"
            value={settings ? `${settings.working_days_rule} days` : '—'}
            icon={<Groups />}
            color="#3B82F6"
            loading={loading}
            sublabel="Per month"
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Salary Components', desc: 'Define earnings & deductions', icon: <PieChart />, path: '/app/payroll/components', color: '#6366F1' },
          { label: 'Salary Structures', desc: 'Build reusable templates', icon: <TrendingUp />, path: '/app/payroll/templates', color: '#0D9488' },
          { label: 'Employee Assignment', desc: 'Assign templates to staff', icon: <Groups />, path: '/app/payroll/assignments', color: '#F59E0B' },
          { label: 'Payroll Settings', desc: 'Cycle & payout configuration', icon: <Schedule />, path: '/app/payroll/settings', color: '#3B82F6' },
        ].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item.label}>
            <Card
              sx={{
                borderRadius: 3, cursor: 'pointer', border: '1px solid #E2E8F0',
                transition: 'all 0.2s',
                '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.1)', transform: 'translateY(-2px)', borderColor: item.color },
              }}
              onClick={() => navigate(item.path)}
            >
              <CardContent sx={{ p: 3 }}>
                <Avatar sx={{ bgcolor: `${item.color}15`, color: item.color, mb: 2, width: 46, height: 46 }}>
                  {item.icon}
                </Avatar>
                <Typography fontWeight={700} sx={{ mb: 0.5 }}>{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <ArrowForward sx={{ color: item.color, fontSize: 18 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Current Cycle CTA */}
      {currentCycle && (
        <Card sx={{
          mb: 4, borderRadius: 3,
          background: currentCycle.status === 'paid'
            ? 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)'
            : 'linear-gradient(135deg, #1E40AF 0%, #1D4ED8 100%)',
          color: '#fff',
        }}>
          <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {MONTH_NAMES[currentCycle.cycle_month - 1]} {currentCycle.cycle_year} Payroll
              </Typography>
              <Typography sx={{ opacity: 0.85, mt: 0.5 }}>
                {currentCycle.total_employees || 0} employees ·{' '}
                Net: {currency(currentCycle.total_net_salary)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <StatusBadge status={currentCycle.status} />
              <Button
                variant="contained"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' }, borderRadius: 2, color: '#fff', fontWeight: 700 }}
                endIcon={<ArrowForward />}
                onClick={() => navigate(`/app/payroll/run/${currentCycle.id}`)}
              >
                Manage Cycle
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Recent Cycles */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Payroll History</Typography>
            <Button variant="text" size="small" endIcon={<ArrowForward />} onClick={() => navigate('/app/payroll/history')}>
              View All
            </Button>
          </Box>

          {loading ? (
            [1,2,3].map(i => <Skeleton key={i} height={56} sx={{ mb: 1 }} />)
          ) : recentCycles.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Schedule sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>No payroll cycles yet. Create your first cycle above.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                    <TableCell>Period</TableCell>
                    <TableCell>Employees</TableCell>
                    <TableCell>Gross</TableCell>
                    <TableCell>Net</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentCycles.map((cycle) => (
                    <TableRow key={cycle.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>
                          {MONTH_NAMES[cycle.cycle_month - 1]} {cycle.cycle_year}
                        </Typography>
                      </TableCell>
                      <TableCell>{cycle.total_employees || 0}</TableCell>
                      <TableCell>{currency(cycle.total_gross_salary)}</TableCell>
                      <TableCell><strong>{currency(cycle.total_net_salary)}</strong></TableCell>
                      <TableCell><StatusBadge status={cycle.status} /></TableCell>
                      <TableCell>
                        <Button size="small" endIcon={<ArrowForward />} onClick={() => navigate(`/app/payroll/run/${cycle.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Cycle Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create Payroll Cycle</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select the month and year to generate the payroll cycle for all active employees.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Month</InputLabel>
              <Select
                value={selectedMonth}
                label="Month"
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <MenuItem key={idx + 1} value={idx + 1}>{name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateCycle}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : null}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
