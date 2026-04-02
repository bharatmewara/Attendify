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

  useEffect(() => {
    load(month, year);
  }, []);

  const summary = data?.summary || null;
  const target = data?.target_sales_amount ? Number(data.target_sales_amount) : null;
  const salesTotal = Number(summary?.sales_total || 0);
  const progressPct = target ? Math.min(100, Math.round((salesTotal / target) * 100)) : null;
  const targetLeft = target ? Math.max(0, target - salesTotal) : null;

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
              <Table size="small">
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
                      <TableCell>{row.client_name}</TableCell>
                      <TableCell>{row.product_name}</TableCell>
                      <TableCell>{String(row.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</TableCell>
                      <TableCell>{row.payment_mode || 'N/A'}</TableCell>
                      <TableCell>{row.sms_quantity ?? '—'}</TableCell>
                      <TableCell>{Number(row.price || 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{row.client_mobile_1 || row.client_mobile_2 ? `${row.client_mobile_1 || ''}${row.client_mobile_2 ? `, ${row.client_mobile_2}` : ''}` : '—'}</TableCell>
                      <TableCell>{row.client_email || '—'}</TableCell>
                      <TableCell>{row.client_location || '—'}</TableCell>
                      <TableCell>{row.client_panel_username || '—'}</TableCell>
                      <TableCell>{row.client_panel_password || '—'}</TableCell>
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
      </Stack>
    </Box>
  );
}
