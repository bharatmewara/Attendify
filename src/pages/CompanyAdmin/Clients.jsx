import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { Close, Visibility } from '@mui/icons-material';
import { API_BASE_URL, apiRequest } from '../../lib/api';


const uploadsBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

const toScreenshotUrl = (screenshotPath) => {
  if (!screenshotPath) return '';

  const normalized = String(screenshotPath).replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  const relative = (idx >= 0 ? normalized.slice(idx) : normalized).replace(/^\/+/, '');

  return `${uploadsBaseUrl}/${relative}`;
};

export default function ClientsManagement() {
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientQuery, setClientQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const loadClients = async (q = clientQuery, from = dateFrom, to = dateTo) => {
    try {
      setClientsLoading(true);
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      if (from) qs.set('date_from', from);
      if (to) qs.set('date_to', to);
      const rows = await apiRequest(`/incentives/clients?${qs.toString()}`);
      setClients(rows || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setClientsLoading(false);
    }
  };

  const applyQuickRange = (range) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    let from = '';
    let to = fmt(today);

    if (range === 'today') {
      from = fmt(today);
    } else if (range === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      from = fmt(d);
    } else if (range === 'month') {
      from = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (range === 'last_month') {
      from = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      to = fmt(new Date(today.getFullYear(), today.getMonth(), 0));
    } else if (range === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      from = fmt(new Date(today.getFullYear(), q * 3, 1));
    } else if (range === 'year') {
      from = fmt(new Date(today.getFullYear(), 0, 1));
    }

    setDateFrom(from);
    setDateTo(to);
    loadClients(clientQuery, from, to);
  };

  const handleReset = () => {
    setClientQuery('');
    setDateFrom('');
    setDateTo('');
    loadClients('', '', '');
  };

  useEffect(() => {
    loadClients('', '', '');
  }, []);

  const openClient = (client) => {
    setSelectedClient(client);
    setClientDialogOpen(true);
  };

  const closeClientDialog = () => {
    setClientDialogOpen(false);
    setSelectedClient(null);
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={3}>
        Clients Database
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>All Clients</Typography>
              <Typography color="text.secondary">Clients secured through incentive submissions.</Typography>
            </Box>

            <Stack spacing={1.5} sx={{ minWidth: { md: 600 } }}>
              {/* Quick Range Buttons */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {[
                  { label: 'Today', value: 'today' },
                  { label: 'This Week', value: 'week' },
                  { label: 'This Month', value: 'month' },
                  { label: 'Last Month', value: 'last_month' },
                  { label: 'This Quarter', value: 'quarter' },
                  { label: 'This Year', value: 'year' },
                ].map((r) => (
                  <Chip
                    key={r.value}
                    label={r.label}
                    onClick={() => applyQuickRange(r.value)}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>

              {/* Date Range + Search */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  label="From Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  sx={{ minWidth: 150 }}
                />
                <TextField
                  size="small"
                  label="To Date"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  sx={{ minWidth: 150 }}
                />
                <TextField
                  size="small"
                  label="Search name/mobile/email"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadClients()}
                  sx={{ flexGrow: 1, minWidth: 200 }}
                />
                <Button
                  variant="contained"
                  onClick={() => loadClients()}
                  disabled={clientsLoading}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  disabled={clientsLoading}
                >
                  Reset
                </Button>
              </Stack>

              {/* Active filter summary */}
              {(dateFrom || dateTo) && (
                <Typography variant="caption" color="text.secondary">
                  Showing: {dateFrom || '...'} {'→'} {dateTo || '...'}
                  &nbsp;({clients.length} result{clients.length !== 1 ? 's' : ''})
                </Typography>
              )}
            </Stack>
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Last Product</TableCell>
                  <TableCell align="right">Last SMS Qty</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Panel User</TableCell>
                  <TableCell>Password</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Total Sales</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((row) => (
                  <TableRow key={row.client_key}>
                    <TableCell>{row.client_name || 'N/A'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.last_product || row.product_name || 'N/A'}</TableCell>
                    <TableCell align="right">{row.last_sms_quantity ?? row.sms_quantity ?? 'N/A'}</TableCell>
                    <TableCell>{row.client_mobile_1 || 'N/A'}</TableCell>
                    <TableCell>{row.client_email || 'N/A'}</TableCell>
                    <TableCell>{row.client_panel_username || 'N/A'}</TableCell>
                    <TableCell>{row.client_panel_password || 'N/A'}</TableCell>
                    <TableCell>
                      {row.first_name ? `${row.first_name} ${row.last_name} (${row.employee_code || 'N/A'})` : 'N/A'}
                    </TableCell>
                    <TableCell>₹{Number(row.total_sales || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${Number(row.approved_count || 0)}/${Number(row.submissions_count || 0)}`}
                        color={Number(row.approved_count || 0) === Number(row.submissions_count || 0) ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="text" onClick={() => openClient(row)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <Typography variant="body2" color="text.secondary">
                        {clientsLoading ? 'Loading clients...' : 'No clients found.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <Dialog open={clientDialogOpen} onClose={closeClientDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Client Details</Typography>
            <IconButton onClick={closeClientDialog}>
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" gutterBottom>Client Information</Typography>
                <Stack spacing={1}>
                  <Typography><strong>Name:</strong> {selectedClient.client_name || 'N/A'}</Typography>
                  <Typography><strong>Last Product:</strong> {selectedClient.last_product || 'N/A'}</Typography>
                  <Typography><strong>Last SMS Qty:</strong> {selectedClient.last_sms_quantity ?? 'N/A'}</Typography>
                  <Typography><strong>Mobile:</strong> {selectedClient.client_mobile_1 || 'N/A'}</Typography>
                  <Typography><strong>Email:</strong> {selectedClient.client_email || 'N/A'}</Typography>
                  <Typography><strong>Panel Username:</strong> {selectedClient.client_panel_username || 'N/A'}</Typography>
                  <Typography><strong>Panel Password:</strong> {selectedClient.client_panel_password || 'N/A'}</Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>Employee Information</Typography>
                <Stack spacing={1}>
                  <Typography>
                    <strong>Employee:</strong> {selectedClient.first_name ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'N/A'}
                  </Typography>
                  <Typography><strong>Employee Code:</strong> {selectedClient.employee_code || 'N/A'}</Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>Sales Summary</Typography>
                <Stack spacing={1}>
                  <Typography><strong>Total Sales:</strong> ₹{Number(selectedClient.total_sales || 0).toLocaleString()}</Typography>
                  <Typography><strong>Approved Submissions:</strong> {Number(selectedClient.approved_count || 0)}</Typography>
                  <Typography><strong>Total Submissions:</strong> {Number(selectedClient.submissions_count || 0)}</Typography>
                </Stack>
              </Box>

              {selectedClient.submissions && selectedClient.submissions.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Recent Submissions</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>Price</TableCell>
                          <TableCell>Incentive</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedClient.submissions.slice(0, 5).map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell>{sub.product_name}</TableCell>
                            <TableCell>₹{Number(sub.price || 0).toLocaleString()}</TableCell>
                            <TableCell>₹{Number(sub.incentive_amount || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Chip
                                label={sub.status}
                                color={sub.status === 'approved' ? 'success' : sub.status === 'pending' ? 'warning' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{new Date(sub.created_at).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeClientDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
