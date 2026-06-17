import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField,
  MenuItem, Alert, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, CircularProgress, Skeleton,
  InputAdornment,
} from '@mui/material';
import { History, FileDownload, ArrowForward, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../lib/api';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const STATUS_CFG = {
  draft:      { color: '#6B7280', bg: '#F3F4F6' },
  approved:   { color: '#059669', bg: '#ECFDF5' },
  paid:       { color: '#0D9488', bg: '#F0FDFA' },
  cancelled:  { color: '#DC2626', bg: '#FEF2F2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.4, borderRadius: 99, fontSize: '0.7rem', fontWeight: 600, color: cfg.color, bgcolor: cfg.bg }}>
      {status}
    </Box>
  );
}

export default function PayrollHistory() {
  const navigate = useNavigate();
  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filters,   setFilters]   = useState({
    month: '', year: new Date().getFullYear(), employee_id: '', status: '',
  });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.month)       params.set('month', filters.month);
      if (filters.year)        params.set('year', filters.year);
      if (filters.employee_id) params.set('employee_id', filters.employee_id);
      if (filters.status)      params.set('status', filters.status);

      const [hist, emps] = await Promise.all([
        apiRequest(`/payroll/history?${params}`),
        apiRequest('/employees'),
      ]);
      setRecords(hist || []);
      setEmployees(emps || []);
    } catch {}
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const exportCSV = () => {
    if (!records.length) return;
    const headers = ['Employee', 'Code', 'Month', 'Year', 'Gross', 'Net', 'Incentives', 'Deductions', 'Present Days', 'Status'];
    const rows = records.map(r => [
      `${r.first_name} ${r.last_name}`,
      r.employee_code,
      MONTH_NAMES[r.cycle_month - 1],
      r.cycle_year,
      r.gross_salary,
      r.net_salary,
      r.incentive_total,
      r.total_deductions,
      r.present_days,
      r.status,
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `payroll-history-${filters.year}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const totalNet   = records.reduce((s, r) => s + Number(r.net_salary   || 0), 0);
  const totalGross = records.reduce((s, r) => s + Number(r.gross_salary || 0), 0);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
            Payroll History
          </Typography>
          <Typography color="text.secondary">
            View and export historical payroll records across all cycles
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<FileDownload />} onClick={exportCSV} disabled={!records.length}>
          Export CSV
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth select label="Month" size="small" value={filters.month}
                onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}
              >
                <MenuItem value="">All Months</MenuItem>
                {MONTH_NAMES.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth select label="Year" size="small" value={filters.year}
                onChange={e => setFilters(p => ({ ...p, year: e.target.value }))}
              >
                {[2024, 2025, 2026, 2027].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth select label="Employee" size="small" value={filters.employee_id}
                onChange={e => setFilters(p => ({ ...p, employee_id: e.target.value }))}
              >
                <MenuItem value="">All Employees</MenuItem>
                {employees.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.employee_code})</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth select label="Status" size="small" value={filters.status}
                onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value="">All Status</MenuItem>
                {['draft','approved','paid','cancelled'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Row */}
      {records.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Records Found', value: records.length, color: '#6366F1' },
            { label: 'Total Gross',   value: currency(totalGross), color: '#3B82F6' },
            { label: 'Total Net',     value: currency(totalNet),   color: '#059669' },
          ].map(({ label, value, color }) => (
            <Grid item xs={12} sm={4} key={label}>
              <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${color}` }}>
                <CardContent sx={{ py: 1.5, px: 2.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{label}</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color }}>{value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Table */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            [1,2,3,4,5].map(i => <Skeleton key={i} height={56} sx={{ mb: 1 }} />)
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC', fontSize: '0.78rem' } }}>
                    <TableCell>Employee</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell align="right">Present</TableCell>
                    <TableCell align="right">Gross</TableCell>
                    <TableCell align="right">Incentives</TableCell>
                    <TableCell align="right">Deductions</TableCell>
                    <TableCell align="right">Net Salary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Payslip</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        <History sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                        <Typography>No payroll records found for selected filters</Typography>
                      </TableCell>
                    </TableRow>
                  ) : records.map(r => (
                    <TableRow key={r.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{r.first_name} {r.last_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.employee_code}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{MONTH_NAMES[r.cycle_month - 1]} {r.cycle_year}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{r.present_days}/{r.working_days}</Typography>
                      </TableCell>
                      <TableCell align="right">{currency(r.gross_salary)}</TableCell>
                      <TableCell align="right" sx={{ color: '#F59E0B' }}>{currency(r.incentive_total)}</TableCell>
                      <TableCell align="right" sx={{ color: '#DC2626' }}>{currency(r.total_deductions)}</TableCell>
                      <TableCell align="right"><strong style={{ color: '#059669' }}>{currency(r.net_salary)}</strong></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell>
                        {(r.status === 'approved' || r.status === 'paid') && (
                          <Button size="small" endIcon={<ArrowForward sx={{ fontSize: 13 }} />} onClick={() => navigate(`/app/payroll/payslip/${r.id}`)}>
                            View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
