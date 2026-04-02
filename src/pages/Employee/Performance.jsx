import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const motivationalMessage = ({ target, salesTotal }) => {
  if (!target) return 'Ask your admin to set your monthly target.';
  if (salesTotal >= target) return 'Target completed. Great work!';
  const pct = (salesTotal / target) * 100;
  if (pct >= 90) return 'Just a little push more left — your reward is waiting.';
  if (pct >= 75) return 'Almost there. Keep it up, you can do it.';
  if (pct >= 50) return 'Good progress. Keep pushing towards your target.';
  return 'Start strong — every client counts.';
};

export default function EmployeePerformance() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [monthsBack, setMonthsBack] = useState(6);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [officeOnlyBlocked, setOfficeOnlyBlocked] = useState(false);

  const load = async (nextMonth = month, nextYear = year) => {
    try {
      const qs = new URLSearchParams();
      qs.set('month', String(nextMonth));
      qs.set('year', String(nextYear));
      const res = await apiRequest(`/incentives/performance?${qs.toString()}`);
      setData(res || null);
      setOfficeOnlyBlocked(false);
      setMessage({ type: '', text: '' });
    } catch (error) {
      const msg = String(error?.message || 'Request failed');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setOfficeOnlyBlocked(true);
        setData(null);
        setMessage({ type: 'warning', text: 'Sales, targets, and incentives can be viewed only from office-approved network.' });
        return;
      }
      setMessage({ type: 'error', text: msg });
    }
  };

  const loadHistory = async (nextMonthsBack = monthsBack) => {
    try {
      const qs = new URLSearchParams();
      qs.set('months_back', String(nextMonthsBack));
      const res = await apiRequest(`/incentives/performance/history?${qs.toString()}`);
      setHistory(res || null);
      setOfficeOnlyBlocked(false);
      setMessage({ type: '', text: '' });
    } catch (error) {
      const msg = String(error?.message || 'Request failed');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setOfficeOnlyBlocked(true);
        setHistory(null);
        setMessage({ type: 'warning', text: 'Sales, targets, and incentives can be viewed only from office-approved network.' });
        return;
      }
      setMessage({ type: 'error', text: msg });
    }
  };

  useEffect(() => {
    load(month, year);
    loadHistory(monthsBack);
  }, []);

  const summary = data?.summary || null;
  const target = data?.target_sales_amount ? Number(data.target_sales_amount) : null;
  const salesTotal = Number(summary?.sales_total || 0);
  const progressPct = target ? Math.min(100, Math.round((salesTotal / target) * 100)) : null;
  const targetLeft = target ? Math.max(0, target - salesTotal) : null;

  const historyGroups = Array.isArray(history?.groups) ? history.groups : [];
  const searchNorm = String(search || '').trim().toLowerCase();
  const filteredHistoryGroups = useMemo(() => {
    if (!searchNorm) return historyGroups;
    return historyGroups
      .map((g) => ({
        ...g,
        details: (g.details || []).filter((row) => {
          const hay = [
            row.client_name,
            row.client_mobile_1,
            row.client_mobile_2,
            row.client_email,
            row.client_panel_username,
            row.product_name,
            row.client_location,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(searchNorm);
        }),
      }))
      .filter((g) => (g.details || []).length > 0);
  }, [historyGroups, searchNorm]);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={2.5}>
        {message.text ? <Alert severity={message.type || 'info'}>{message.text}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/app/dashboard')}>
              Back
            </Button>
            <Box>
              <Typography variant="h5" fontWeight={900}>My Performance</Typography>
              <Typography color="text.secondary">Targets, monthly sales, incentives and client counts.</Typography>
            </Box>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField
              size="small"
              label="Month"
              type="number"
              value={month}
              onChange={(e) => setMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              inputProps={{ min: 1, max: 12 }}
              sx={{ width: { xs: '100%', sm: 120 } }}
            />
            <TextField
              size="small"
              label="Year"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
              sx={{ width: { xs: '100%', sm: 140 } }}
            />
            <Button variant="contained" onClick={() => load(month, year)} disabled={officeOnlyBlocked}>Load</Button>
          </Stack>
        </Stack>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Clients: ${Number(summary?.clients_total || 0)}`} />
                <Chip label={`New: ${Number(summary?.new_count || 0)}`} />
                <Chip label={`Renew: ${Number(summary?.renew_count || 0)}`} />
                <Chip color="primary" label={`Sales: ${salesTotal.toLocaleString()}`} />
                <Chip color="success" label={`Incentives: ${Number(summary?.incentives_total || 0).toFixed(2)}`} />
                <Chip variant="outlined" label={`SMS: ${Number(summary?.sms_total || 0).toLocaleString()}`} />
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Typography fontWeight={800}>Target:</Typography>
                <Typography>{target ? target.toLocaleString() : 'Not set'}</Typography>
                {progressPct !== null ? <Chip label={`Progress: ${progressPct}%`} /> : null}
                {targetLeft !== null ? <Chip variant="outlined" label={`Left: ${targetLeft.toLocaleString()}`} /> : null}
                <Typography color="text.secondary">{motivationalMessage({ target, salesTotal })}</Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>Payment Breakdown</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Payment Mode</TableCell>
                    <TableCell>Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.payment_breakdown || []).map((row) => (
                    <TableRow key={row.payment_mode}>
                      <TableCell>{row.payment_mode}</TableCell>
                      <TableCell>{Number(row.total || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.payment_breakdown || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="body2" color="text.secondary">No payment data for this month.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>Approved Sales Details</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ minWidth: 1600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>SMS Qty</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Incentive</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Panel User</TableCell>
                    <TableCell>Panel Pass</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.details || []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.client_name || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.product_name || '—'}</TableCell>
                      <TableCell>{String(row.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</TableCell>
                      <TableCell>{row.payment_mode || 'N/A'}</TableCell>
                      <TableCell>{row.sms_quantity ?? '—'}</TableCell>
                      <TableCell>{Number(row.price || 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {row.client_mobile_1 || row.clientMobile1 || row.client_mobile1 || row.client_mobile_2 || row.clientMobile2 || row.client_mobile2
                          ? `${row.client_mobile_1 || row.clientMobile1 || row.client_mobile1 || ''}${(row.client_mobile_2 || row.clientMobile2 || row.client_mobile2) ? `, ${row.client_mobile_2 || row.clientMobile2 || row.client_mobile2}` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_email || row.clientEmail || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_location || row.clientLocation || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_username || row.clientPanelUsername || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_password || row.clientPanelPassword || '—'}</TableCell>
                      <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString('en-IN') : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13}>
                        <Typography variant="body2" color="text.secondary">No approved sales found for this month.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={900}>Month-wise Approved Sales</Typography>
                <Typography variant="body2" color="text.secondary">Find any client quickly across months.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  select
                  label="Months"
                  value={monthsBack}
                  onChange={(e) => setMonthsBack(Number(e.target.value) || 6)}
                  sx={{ width: { xs: '100%', sm: 140 } }}
                >
                  <MenuItem value={3}>Last 3</MenuItem>
                  <MenuItem value={6}>Last 6</MenuItem>
                  <MenuItem value={12}>Last 12</MenuItem>
                </TextField>
                <Button variant="outlined" onClick={() => loadHistory(monthsBack)} disabled={officeOnlyBlocked}>
                  Load
                </Button>
                <TextField
                  size="small"
                  label="Search client"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 260 } }}
                  helperText="name / mobile / email / panel"
                />
              </Stack>
            </Stack>

            <Stack spacing={2}>
              {(filteredHistoryGroups || []).map((g) => {
                const label = new Date(g.year, g.month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
                return (
                  <Paper key={`${g.year}-${g.month}`} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ p: 2 }}>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
                        <Typography fontWeight={900}>{label}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Chip label={`Clients: ${Number(g.summary?.clients_total || 0)}`} />
                          <Chip label={`SMS: ${Number(g.summary?.sms_total || 0).toLocaleString()}`} variant="outlined" />
                          <Chip label={`Sales: ${Number(g.summary?.sales_total || 0).toLocaleString()}`} color="primary" />
                          <Chip label={`Incentives: ${Number(g.summary?.incentives_total || 0).toFixed(2)}`} color="success" />
                        </Stack>
                      </Stack>
                    </Box>
                    <Divider />
                    <TableContainer component={Paper} elevation={0}>
                      <Table size="small" sx={{ minWidth: 1600 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Client</TableCell>
                            <TableCell>Product</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Payment</TableCell>
                            <TableCell>SMS Qty</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Incentive</TableCell>
                            <TableCell>Mobile</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Panel User</TableCell>
                            <TableCell>Panel Pass</TableCell>
                            <TableCell>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(g.details || []).map((row) => (
                            <TableRow key={row.id}>
                              <TableCell sx={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.client_name || '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.product_name || '—'}</TableCell>
                              <TableCell>{String(row.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</TableCell>
                              <TableCell>{row.payment_mode || 'N/A'}</TableCell>
                              <TableCell>{row.sms_quantity ?? '—'}</TableCell>
                              <TableCell>{Number(row.price || 0).toLocaleString()}</TableCell>
                              <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {row.client_mobile_1 || row.client_mobile_2
                                  ? `${row.client_mobile_1 || ''}${row.client_mobile_2 ? `, ${row.client_mobile_2}` : ''}`
                                  : '—'}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_email || '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_location || '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_username || '—'}</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_password || '—'}</TableCell>
                              <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString('en-IN') : 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                          {(g.details || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={13}>
                                <Typography variant="body2" color="text.secondary">No records.</Typography>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                );
              })}

              {(filteredHistoryGroups || []).length === 0 ? (
                <Alert severity="info">
                  {history ? 'No records found for your search.' : 'Click Load to view month-wise approved sales.'}
                </Alert>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
