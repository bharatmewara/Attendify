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
import { Close, Visibility, Download, InsertDriveFile } from '@mui/icons-material';
import { API_BASE_URL, apiRequest } from '../../lib/api';
import { exportRowsToCsv } from '../../utils/fileExports';


const uploadsBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

const toScreenshotUrl = (screenshotPath) => {
  if (!screenshotPath) return '';

  const normalized = String(screenshotPath).replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  const relative = (idx >= 0 ? normalized.slice(idx) : normalized).replace(/^\/+/, '');

  return `${uploadsBaseUrl}/${relative}`;
};

const RUPEE = '\u20B9';
const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const handleExportCsv = () => {
    const filename = `clients${dateFrom ? `_${dateFrom}` : ''}${dateTo ? `_to_${dateTo}` : ''}.csv`;
    exportRowsToCsv(clients, [
      { label: 'Name', value: 'client_name' },
      { label: 'Mobile no', value: 'client_mobile_1' },
      { label: 'Mobile no 2', value: 'client_mobile_2' },
      { label: 'Email', value: 'client_email' },
      { label: 'Product', value: (r) => r.last_product || r.product_name || '' },
      { label: 'SMS Qty', value: (r) => r.last_sms_quantity ?? r.sms_quantity ?? '' },
      { label: 'Price', value: (r) => r.last_price_ex_gst ?? '' },
      { label: 'Rate', value: (r) => r.last_rate != null ? r.last_rate : '—' },
      { label: 'Sales Date', value: (r) => r.last_approved_at || r.last_submitted_at || '' },
      { label: 'Employee By', value: (r) => r.first_name ? `${r.first_name} ${r.last_name}` : '' },
      { label: 'Panel Username', value: 'client_panel_username' },
      { label: 'Panel Password', value: 'client_panel_password' },
      { label: 'Payment Mode', value: (r) => r.last_payment_mode || '' },
      { label: 'Type', value: (r) => r.last_package_type ? r.last_package_type.charAt(0).toUpperCase() + r.last_package_type.slice(1) : '' },
      { label: 'KYC Document', value: (r) => r.last_kyc_path ? toScreenshotUrl(r.last_kyc_path) : '' },
      { label: 'Employee Client Count', value: (r) => r.submissions_count || '' },
      { label: 'City', value: (r) => r.last_location || '' },
      { label: 'GST Amount', value: (r) => r.last_amount_received ?? '' },
    ], filename);
  };

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

            <Button variant="outlined" color="success" startIcon={<Download />} onClick={handleExportCsv} disabled={clients.length === 0} sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>
              Export CSV
            </Button>
          </Stack>

          <Stack spacing={1.25} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
                { label: 'Last Month', value: 'last_month' },
                { label: 'This Quarter', value: 'quarter' },
                { label: 'This Year', value: 'year' },
              ].map((r) => (
                <Chip key={r.value} label={r.label} onClick={() => applyQuickRange(r.value)} color="primary" variant="outlined" size="small" sx={{ cursor: 'pointer' }} />
              ))}
            </Stack>

            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField size="small" label="From Date" type="date" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} sx={{ width: 160 }} />
              <TextField size="small" label="To Date" type="date" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} sx={{ width: 160 }} />
              <TextField size="small" label="Search (name/mobile/email)" value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadClients()} sx={{ width: 240 }} />
              <Button variant="contained" onClick={() => loadClients()} disabled={clientsLoading} sx={{ whiteSpace: 'nowrap' }}>Search</Button>
              <Button variant="outlined" onClick={handleReset} disabled={clientsLoading}>Reset</Button>
            </Stack>

            {(dateFrom || dateTo) && (
              <Typography variant="caption" color="text.secondary">
                Showing: {dateFrom || '...'} {'→'} {dateTo || '...'}
                &nbsp;({clients.length} result{clients.length !== 1 ? 's' : ''})
              </Typography>
            )}
          </Stack>

          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Client</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell align="right">SMS Qty</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Received (incl GST)</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Panel User</TableCell>
                  <TableCell>Password</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell align="right">Total Received (incl GST)</TableCell>
                  <TableCell>Approved</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>KYC</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((row) => (
                  <TableRow key={row.client_key}>
                    <TableCell>{row.client_name || 'N/A'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.last_product || row.product_name || 'N/A'}</TableCell>
                    <TableCell align="right">{row.last_sms_quantity ?? row.sms_quantity ?? 'N/A'}</TableCell>
                    <TableCell align="right">{row.last_rate != null ? row.last_rate : '—'}</TableCell>
                    <TableCell align="right">
                      {row.last_amount_received !== null && row.last_amount_received !== undefined
                        ? `${RUPEE}${formatMoney(row.last_amount_received)}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{row.client_mobile_1 || 'N/A'}</TableCell>
                    <TableCell>{row.client_email || 'N/A'}</TableCell>
                    <TableCell>{row.client_panel_username || 'N/A'}</TableCell>
                    <TableCell>{row.client_panel_password || 'N/A'}</TableCell>
                    <TableCell>
                      {row.first_name ? `${row.first_name} ${row.last_name} (${row.employee_code || 'N/A'})` : 'N/A'}
                    </TableCell>
                    <TableCell align="right">{`${RUPEE}${formatMoney(row.total_received ?? row.total_sales ?? 0)}`}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${Number(row.approved_count || 0)}/${Number(row.submissions_count || 0)}`}
                        color={Number(row.approved_count || 0) === Number(row.submissions_count || 0) ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {row.last_package_type ? (
                        <Chip size="small" label={row.last_package_type.charAt(0).toUpperCase() + row.last_package_type.slice(1)} color={row.last_package_type === 'new' ? 'success' : 'default'} variant="outlined" />
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.last_kyc_path ? (
                        <Button size="small" startIcon={<InsertDriveFile />} onClick={() => window.open(toScreenshotUrl(row.last_kyc_path), '_blank')}>
                          View
                        </Button>
                      ) : <Typography variant="caption" color="text.secondary">—</Typography>}
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
                    <TableCell colSpan={15}>
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
                  <Typography><strong>Product:</strong> {selectedClient.last_product || 'N/A'}</Typography>
                  <Typography><strong>SMS Qty:</strong> {selectedClient.last_sms_quantity ?? 'N/A'}</Typography>
                  <Typography><strong>Last Price (excl GST):</strong> {selectedClient.last_price_ex_gst !== null && selectedClient.last_price_ex_gst !== undefined ? `${RUPEE}${formatMoney(selectedClient.last_price_ex_gst)}` : 'N/A'}</Typography>
                  <Typography><strong>Last GST (18%):</strong> {selectedClient.last_gst_amount !== null && selectedClient.last_gst_amount !== undefined ? `${RUPEE}${formatMoney(selectedClient.last_gst_amount)}` : 'N/A'}</Typography>
                  <Typography><strong>Last Amount Received (incl GST):</strong> {selectedClient.last_amount_received !== null && selectedClient.last_amount_received !== undefined ? `${RUPEE}${formatMoney(selectedClient.last_amount_received)}` : 'N/A'}</Typography>
                  <Typography><strong>Mobile:</strong> {selectedClient.client_mobile_1 || 'N/A'}</Typography>
                  <Typography><strong>Email:</strong> {selectedClient.client_email || 'N/A'}</Typography>
                  <Typography><strong>Panel Username:</strong> {selectedClient.client_panel_username || 'N/A'}</Typography>
                  <Typography><strong>Panel Password:</strong> {selectedClient.client_panel_password || 'N/A'}</Typography>
                </Stack>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>KYC Documents</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {selectedClient.last_kyc_path ? (
                    <Button
                      variant="outlined"
                      startIcon={<InsertDriveFile />}
                      onClick={() => window.open(toScreenshotUrl(selectedClient.last_kyc_path), '_blank')}
                    >
                      View KYC Document
                    </Button>
                  ) : (
                    <Typography color="text.secondary">No KYC document uploaded.</Typography>
                  )}
                  {selectedClient.last_screenshot_path ? (
                    <Button
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={() => window.open(toScreenshotUrl(selectedClient.last_screenshot_path), '_blank')}
                    >
                      View Screenshot
                    </Button>
                  ) : null}
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
                  <Typography><strong>Total Received (incl GST):</strong> {`${RUPEE}${formatMoney(selectedClient.total_received ?? selectedClient.total_sales ?? 0)}`}</Typography>
                  <Typography><strong>Total GST:</strong> {`${RUPEE}${formatMoney(selectedClient.total_gst_amount ?? 0)}`}</Typography>
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
                            <TableCell>{`${RUPEE}${Number(sub.price || 0).toLocaleString()}`}</TableCell>
                            <TableCell>{`${RUPEE}${Number(sub.incentive_amount || 0).toLocaleString()}`}</TableCell>
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
