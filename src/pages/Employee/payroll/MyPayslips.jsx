import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Skeleton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Alert, Avatar,
} from '@mui/material';
import { Receipt, ArrowForward, MonetizationOn } from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const STATUS_CFG = {
  approved: { color: '#059669', bg: '#ECFDF5', label: 'Approved' },
  paid:     { color: '#0D9488', bg: '#F0FDFA', label: 'Paid' },
};

export default function MyPayslips() {
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    apiRequest('/payroll/my-payslips')
      .then(data => setPayslips(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const latest = payslips[0];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>My Payslips</Typography>
        <Typography color="text.secondary">Download and view your monthly salary slips</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Latest payslip hero */}
      {loading ? (
        <Skeleton height={160} sx={{ borderRadius: 3, mb: 3 }} />
      ) : latest ? (
        <Card sx={{ borderRadius: 3, mb: 4, background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#fff' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="body2" sx={{ opacity: 0.7, mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>Latest Payslip</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
              {MONTH_NAMES[latest.cycle_month - 1]} {latest.cycle_year}
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {[
                { label: 'Net Salary',   value: currency(latest.net_salary),   color: '#34D399' },
                { label: 'Days Worked',  value: `${latest.present_days}/${latest.working_days}`, color: '#93C5FD' },
                { label: 'Incentives',   value: currency(latest.incentive_total), color: '#FCD34D' },
                { label: 'Deductions',   value: currency(latest.total_deductions), color: '#F87171' },
              ].map(({ label, value, color }) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>{label}</Typography>
                  <Typography variant="h6" fontWeight={700} sx={{ color }}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 3 }}>
              <Button
                variant="contained"
                startIcon={<Receipt />}
                onClick={() => navigate(`/app/payroll/payslip/${latest.id}`)}
                sx={{ bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, borderRadius: 2, fontWeight: 700, color: '#fff' }}
              >
                View Payslip
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {/* All payslips */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Payslip History</Typography>
          {loading ? (
            [1,2,3].map(i => <Skeleton key={i} height={64} sx={{ mb: 1 }} />)
          ) : payslips.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <MonetizationOn sx={{ fontSize: 56, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6" fontWeight={600}>No payslips yet</Typography>
              <Typography>Your payslips will appear here once salary is processed</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                    <TableCell>Pay Period</TableCell>
                    <TableCell align="right">Days</TableCell>
                    <TableCell align="right">Net Salary</TableCell>
                    <TableCell align="right">Incentives</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payslips.map(ps => {
                    const cfg = STATUS_CFG[ps.status] ?? STATUS_CFG.approved;
                    return (
                      <TableRow key={ps.id} hover>
                        <TableCell>
                          <Typography fontWeight={600}>
                            {MONTH_NAMES[ps.cycle_month - 1]} {ps.cycle_year}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ps.period_start ? new Date(ps.period_start).toLocaleDateString('en-IN') : ''}
                            {' – '}
                            {ps.period_end ? new Date(ps.period_end).toLocaleDateString('en-IN') : ''}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{ps.present_days}/{ps.working_days}</TableCell>
                        <TableCell align="right"><strong style={{ color: '#059669' }}>{currency(ps.net_salary)}</strong></TableCell>
                        <TableCell align="right" sx={{ color: '#F59E0B' }}>{currency(ps.incentive_total)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.4, borderRadius: 99, fontSize: '0.7rem', fontWeight: 600, color: cfg.color, bgcolor: cfg.bg }}>
                            {cfg.label}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button size="small" endIcon={<ArrowForward sx={{ fontSize: 13 }} />} onClick={() => navigate(`/app/payroll/payslip/${ps.id}`)}>
                            View & Print
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
