import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export default function EmployeePerformanceDashboard() {
  const params = useParams();
  const navigate = useNavigate();
  const employeeId = Number(params.employeeId);

  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const load = async (nextMonth = month, nextYear = year) => {
    try {
      const qs = new URLSearchParams();
      qs.set('month', String(nextMonth));
      qs.set('year', String(nextYear));
      qs.set('employee_id', String(employeeId));
      const res = await apiRequest(`/incentives/performance?${qs.toString()}`);
      setData(res || null);
      setMessage({ type: '', text: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if (!employeeId) {
      setMessage({ type: 'error', text: 'Invalid employee id' });
      return;
    }
    load(month, year);
  }, [employeeId]);

  const summary = data?.summary || null;
  const target = data?.target_sales_amount ? Number(data.target_sales_amount) : null;
  const salesTotal = Number(summary?.sales_total || 0);
  const progressPct = target ? Math.min(100, Math.round((salesTotal / target) * 100)) : null;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack spacing={2.5}>
        {message.text ? <Alert severity={message.type || 'info'}>{message.text}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate('/app/employees')}>
              Back
            </Button>
            <Box>
              <Typography variant="h5" fontWeight={900}>Employee Performance Dashboard</Typography>
              <Typography color="text.secondary">Clients closed, sales, incentives, and target progress.</Typography>
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
            <Button variant="contained" onClick={() => load(month, year)}>Load</Button>
            <Button variant="text" onClick={() => navigate('/app/incentives')}>Open Incentives</Button>
          </Stack>
        </Stack>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography fontWeight={900}>
                {data?.employee?.first_name} {data?.employee?.last_name} ({data?.employee?.employee_code || 'N/A'})
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Clients: ${Number(summary?.clients_total || 0)}`} />
                <Chip label={`New: ${Number(summary?.new_count || 0)}`} />
                <Chip label={`Renew: ${Number(summary?.renew_count || 0)}`} />
                <Chip color="primary" label={`Sales: ${salesTotal.toLocaleString()}`} />
                <Chip color="success" label={`Incentives: ${Number(summary?.incentives_total || 0).toFixed(2)}`} />
                <Chip variant="outlined" label={`SMS: ${Number(summary?.sms_total || 0).toLocaleString()}`} />
              </Stack>

              <Divider />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Typography fontWeight={800}>Monthly Target:</Typography>
                <Typography>{target ? target.toLocaleString() : 'Not set'}</Typography>
                {progressPct !== null ? <Chip label={`Progress: ${progressPct}%`} /> : null}
                {data?.tier_applied ? (
                  <Chip
                    color="secondary"
                    label={`Tier: >= ${Number(data.tier_applied.min_sales_amount).toLocaleString()} → Salary ${Number(data.tier_applied.target_total_salary).toLocaleString()}`}
                  />
                ) : (
                  <Chip variant="outlined" label="No tier applied" />
                )}
              </Stack>
            </Stack>
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
                    <TableCell>Price</TableCell>
                    <TableCell>Incentive</TableCell>
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
                      <TableCell>{Number(row.price || 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{row.approved_at ? new Date(row.approved_at).toLocaleDateString('en-IN') : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.details || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
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

