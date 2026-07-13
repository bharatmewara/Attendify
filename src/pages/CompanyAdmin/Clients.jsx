import { useEffect, useState, useRef } from 'react';
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
  ListItemIcon,
  Menu,
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
import {
  Close, Visibility, Download, InsertDriveFile, Replay, Delete, MoreVert,
} from '@mui/icons-material';
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
const GST_RATE = 0.18;
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;
const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return 'N/A';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const resolveGstFields = (row) => {
  const gstApplied = Boolean(row?.last_gst_applied);
  const rawEx = row?.last_price_ex_gst;
  const rawInc = row?.last_amount_received ?? row?.last_price_inc_gst;
  const rawGst = row?.last_gst_amount;

  const exNum = rawEx !== null && rawEx !== undefined && rawEx !== '' ? Number(rawEx) : null;
  const incNum = rawInc !== null && rawInc !== undefined && rawInc !== '' ? Number(rawInc) : null;
  const gstNum = rawGst !== null && rawGst !== undefined && rawGst !== '' ? Number(rawGst) : null;

  const excl = Number.isFinite(exNum)
    ? exNum
    : (gstApplied && Number.isFinite(incNum) ? roundMoney(incNum / (1 + GST_RATE)) : null);

  const incl = Number.isFinite(incNum)
    ? incNum
    : (gstApplied && Number.isFinite(excl) ? roundMoney(excl * (1 + GST_RATE)) : excl);

  const gst = Number.isFinite(gstNum)
    ? gstNum
    : (gstApplied && Number.isFinite(incl) && Number.isFinite(excl) ? roundMoney(incl - excl) : 0);

  return { excl, gst, incl };
};

// ── Row-level 3-dot action menu ─────────────────────────────────────────────
function RowActions({ row, onView, onRefund, onDelete }) {
  const [anchor, setAnchor] = useState(null);
  const open = Boolean(anchor);

  return (
    <>
      <IconButton size="small" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        onClick={() => setAnchor(null)}
        PaperProps={{ elevation: 3, sx: { borderRadius: 2, minWidth: 160 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => onView(row)}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          View Details
        </MenuItem>
        {row.last_kyc_path && (
          <MenuItem onClick={() => window.open(toScreenshotUrl(row.last_kyc_path), '_blank')}>
            <ListItemIcon><InsertDriveFile fontSize="small" /></ListItemIcon>
            View KYC
          </MenuItem>
        )}
        {row.last_status === 'approved' && row.last_submission_id && (
          <MenuItem onClick={() => onRefund(row)} sx={{ color: 'warning.main' }}>
            <ListItemIcon><Replay fontSize="small" color="warning" /></ListItemIcon>
            Initiate Refund
          </MenuItem>
        )}
        <MenuItem onClick={() => onDelete(row)} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          Delete Client
        </MenuItem>
      </Menu>
    </>
  );
}

// ── Dual-scrollbar wrapper — shows scrollbar on TOP and BOTTOM ───────────────
function TopScrollTableContainer({ children }) {
  const topRef  = useRef(null);
  const bodyRef = useRef(null);

  const syncFromTop  = () => { if (bodyRef.current) bodyRef.current.scrollLeft = topRef.current.scrollLeft; };
  const syncFromBody = () => { if (topRef.current)  topRef.current.scrollLeft  = bodyRef.current.scrollLeft; };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* ── Top phantom scrollbar ── */}
      <Box
        ref={topRef}
        onScroll={syncFromTop}
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          height: 12,
          mb: '-1px',
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: '#F1F5F9', borderRadius: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#94A3B8', borderRadius: 4, '&:hover': { bgcolor: '#64748B' } },
        }}
      >
        {/* A spacer div that matches the actual table width */}
        <Box sx={{ height: 1, minWidth: 1600 }} />
      </Box>

      {/* ── Actual table with sticky header ── */}
      <TableContainer
        component={Paper}
        variant="outlined"
        ref={bodyRef}
        onScroll={syncFromBody}
        sx={{
          borderRadius: 0,
          overflowX: 'auto',
          '& .MuiTableHead-root .MuiTableRow-root': {
            position: 'sticky',
            top: 0,
            zIndex: 2,
          },
          '& .MuiTableHead-root .MuiTableCell-root': {
            position: 'sticky',
            top: 0,
            bgcolor: '#F8FAFC',
            zIndex: 2,
            boxShadow: 'inset 0 -2px 0 #E2E8F0',
          },
          '&::-webkit-scrollbar': { height: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: '#F1F5F9' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#94A3B8', borderRadius: 4, '&:hover': { bgcolor: '#64748B' } },
        }}
      >
        {children}
      </TableContainer>
    </Box>
  );
}

export default function ClientsManagement() {
  const [clients,           setClients]           = useState([]);
  const [clientsLoading,    setClientsLoading]    = useState(false);
  const [clientQuery,       setClientQuery]       = useState('');
  const [dateFrom,          setDateFrom]          = useState('');
  const [dateTo,            setDateTo]            = useState('');
  const [message,           setMessage]           = useState({ type: '', text: '' });
  const [clientDialogOpen,  setClientDialogOpen]  = useState(false);
  const [selectedClient,    setSelectedClient]    = useState(null);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refundTarget,      setRefundTarget]      = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget,      setDeleteTarget]      = useState(null);

  const loadClients = async (q = clientQuery, from = dateFrom, to = dateTo) => {
    try {
      setClientsLoading(true);
      const qs = new URLSearchParams();
      if (q)    qs.set('q', q);
      if (from) qs.set('date_from', from);
      if (to)   qs.set('date_to', to);
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
    let from = '', to = fmt(today);
    if (range === 'today')      { from = fmt(today); }
    else if (range === 'week')  { const d = new Date(today); d.setDate(d.getDate() - 6); from = fmt(d); }
    else if (range === 'month') { from = fmt(new Date(today.getFullYear(), today.getMonth(), 1)); }
    else if (range === 'last_month') {
      from = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      to   = fmt(new Date(today.getFullYear(), today.getMonth(), 0));
    }
    else if (range === 'quarter') { const q = Math.floor(today.getMonth() / 3); from = fmt(new Date(today.getFullYear(), q * 3, 1)); }
    else if (range === 'year')    { from = fmt(new Date(today.getFullYear(), 0, 1)); }
    setDateFrom(from); setDateTo(to);
    loadClients(clientQuery, from, to);
  };

  const handleReset = () => { setClientQuery(''); setDateFrom(''); setDateTo(''); loadClients('', '', ''); };

  useEffect(() => { loadClients('', '', ''); }, []);

  const handleExportCsv = () => {
    const filename = `clients${dateFrom ? `_${dateFrom}` : ''}${dateTo ? `_to_${dateTo}` : ''}.csv`;
    exportRowsToCsv(clients, [
      { label: 'Name',                    value: 'client_name' },
      { label: 'Mobile no',               value: 'client_mobile_1' },
      { label: 'Mobile no 2',             value: 'client_mobile_2' },
      { label: 'Email',                   value: 'client_email' },
      { label: 'Product',                 value: (r) => r.last_product || r.product_name || '' },
      { label: 'SMS Qty',                 value: (r) => r.last_sms_quantity ?? r.sms_quantity ?? '' },
      { label: 'Price (excl GST)',        value: (r) => resolveGstFields(r).excl ?? '' },
      { label: 'GST Amount',              value: (r) => resolveGstFields(r).gst ?? '' },
      { label: 'Price (incl GST)',        value: (r) => resolveGstFields(r).incl ?? '' },
      { label: 'Rate',                    value: (r) => r.last_rate != null ? r.last_rate : '—' },
      { label: 'Sales Date',              value: (r) => r.last_approved_at || r.last_submitted_at || '' },
      { label: 'Employee By',             value: (r) => r.first_name ? `${r.first_name} ${r.last_name}` : '' },
      { label: 'Panel Username',          value: 'client_panel_username' },
      { label: 'Panel Password',          value: 'client_panel_password' },
      { label: 'Payment Mode',            value: (r) => r.last_payment_mode || '' },
      { label: 'Type',                    value: (r) => r.last_package_type ? r.last_package_type.charAt(0).toUpperCase() + r.last_package_type.slice(1) : '' },
      { label: 'KYC Document',            value: (r) => r.last_kyc_path ? toScreenshotUrl(r.last_kyc_path) : '' },
      { label: 'Employee Client Count',   value: (r) => r.submissions_count || '' },
      { label: 'City',                    value: (r) => r.last_location || '' },
    ], filename);
  };

  const handleInitiateRefund = (row) => { setRefundTarget(row);  setRefundConfirmOpen(true); };
  const handleDeleteClient   = (row) => { setDeleteTarget(row);  setDeleteConfirmOpen(true); };

  const confirmRefund = async () => {
    if (!refundTarget?.last_submission_id) return;
    try {
      await apiRequest(`/incentives/submissions/${refundTarget.last_submission_id}/status`, { method: 'PUT', body: { status: 'refunded' } });
      setMessage({ type: 'success', text: `Refund initiated for ${refundTarget.client_name}.` });
      setRefundConfirmOpen(false); setRefundTarget(null); loadClients();
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.client_key) return;
    try {
      await apiRequest(`/incentives/clients/${deleteTarget.client_key}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `Deleted client ${deleteTarget.client_name}.` });
      setDeleteConfirmOpen(false); setDeleteTarget(null); loadClients();
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  };

  const openClient  = (client) => { setSelectedClient(client); setClientDialogOpen(true); };
  const closeDialog = ()       => { setClientDialogOpen(false); setSelectedClient(null); };

  return (
    <Box>
      <Typography variant="h4" fontWeight={800} mb={3}>Clients Database</Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Card>
        <CardContent>
          {/* ── Header ── */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>All Clients</Typography>
              <Typography color="text.secondary">Clients secured through incentive submissions.</Typography>
            </Box>
            <Button variant="outlined" color="success" startIcon={<Download />} onClick={handleExportCsv} disabled={clients.length === 0} sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>
              Export CSV
            </Button>
          </Stack>

          {/* ── Filters ── */}
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {['today','week','month','last_month','quarter','year'].map((v) => (
                <Chip key={v} label={{ today:'Today', week:'This Week', month:'This Month', last_month:'Last Month', quarter:'This Quarter', year:'This Year' }[v]}
                  onClick={() => applyQuickRange(v)} color="primary" variant="outlined" size="small" sx={{ cursor: 'pointer' }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField size="small" label="From Date" type="date" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} sx={{ width: 160 }} />
              <TextField size="small" label="To Date"   type="date" InputLabelProps={{ shrink: true }} value={dateTo}   onChange={e => setDateTo(e.target.value)}   sx={{ width: 160 }} />
              <TextField size="small" label="Search (name/mobile/email)" value={clientQuery} onChange={e => setClientQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadClients()} sx={{ width: 240 }} />
              <Button variant="contained" onClick={() => loadClients()} disabled={clientsLoading} sx={{ whiteSpace: 'nowrap' }}>Search</Button>
              <Button variant="outlined"  onClick={handleReset}         disabled={clientsLoading}>Reset</Button>
            </Stack>
            {(dateFrom || dateTo) && (
              <Typography variant="caption" color="text.secondary">
                Showing: {dateFrom || '...'} {'→'} {dateTo || '...'}&nbsp;({clients.length} result{clients.length !== 1 ? 's' : ''})
              </Typography>
            )}
          </Stack>

          {/* ── Table with top scrollbar + sticky header ── */}
          <Box sx={{ mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <TopScrollTableContainer>
              <Table size="small" sx={{ minWidth: 1400 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' } }}>
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
                    <TableCell align="right">Total Received</TableCell>
                    <TableCell>Approved</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>KYC</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map((row) => (
                    <TableRow key={row.client_key} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{row.client_name || 'N/A'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.last_product || row.product_name || 'N/A'}</TableCell>
                      <TableCell align="right">{row.last_sms_quantity ?? row.sms_quantity ?? 'N/A'}</TableCell>
                      <TableCell align="right">{row.last_rate != null ? row.last_rate : '—'}</TableCell>
                      <TableCell align="right">
                        {row.last_amount_received != null ? `${RUPEE}${formatMoney(row.last_amount_received)}` : 'N/A'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_mobile_1 || 'N/A'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_email || 'N/A'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_panel_username || 'N/A'}</TableCell>
                      <TableCell>{row.client_panel_password || 'N/A'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
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
                        {row.last_package_type
                          ? <Chip size="small" label={row.last_package_type.charAt(0).toUpperCase() + row.last_package_type.slice(1)} color={row.last_package_type === 'new' ? 'success' : 'default'} variant="outlined" />
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {row.last_kyc_path
                          ? <Chip size="small" label="KYC ✓" color="info" variant="outlined" onClick={() => window.open(toScreenshotUrl(row.last_kyc_path), '_blank')} sx={{ cursor: 'pointer' }} />
                          : <Typography variant="caption" color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell align="center">
                        <RowActions
                          row={row}
                          onView={openClient}
                          onRefund={handleInitiateRefund}
                          onDelete={handleDeleteClient}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={15}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                          {clientsLoading ? 'Loading clients…' : 'No clients found.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TopScrollTableContainer>
          </Box>
        </CardContent>
      </Card>

      {/* ── Client Details Dialog ── */}
      <Dialog open={clientDialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Client Details</Typography>
            <IconButton onClick={closeDialog}><Close /></IconButton>
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
                  <Typography><strong>Last Price (excl GST):</strong> {selectedClient.last_price_ex_gst != null ? `${RUPEE}${formatMoney(selectedClient.last_price_ex_gst)}` : 'N/A'}</Typography>
                  <Typography><strong>Last GST (18%):</strong> {selectedClient.last_gst_amount != null ? `${RUPEE}${formatMoney(selectedClient.last_gst_amount)}` : 'N/A'}</Typography>
                  <Typography><strong>Last Amount Received (incl GST):</strong> {selectedClient.last_amount_received != null ? `${RUPEE}${formatMoney(selectedClient.last_amount_received)}` : 'N/A'}</Typography>
                  <Typography><strong>Mobile:</strong> {selectedClient.client_mobile_1 || 'N/A'}</Typography>
                  <Typography><strong>Email:</strong> {selectedClient.client_email || 'N/A'}</Typography>
                  <Typography><strong>Panel Username:</strong> {selectedClient.client_panel_username || 'N/A'}</Typography>
                  <Typography><strong>Panel Password:</strong> {selectedClient.client_panel_password || 'N/A'}</Typography>
                </Stack>
              </Box>
              <Box>
                <Typography variant="h6" gutterBottom>KYC Documents</Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  {selectedClient.last_kyc_path
                    ? <Button variant="outlined" startIcon={<InsertDriveFile />} onClick={() => window.open(toScreenshotUrl(selectedClient.last_kyc_path), '_blank')}>View KYC Document</Button>
                    : <Typography color="text.secondary">No KYC document uploaded.</Typography>}
                  {selectedClient.last_screenshot_path && (
                    <Button variant="outlined" startIcon={<Visibility />} onClick={() => window.open(toScreenshotUrl(selectedClient.last_screenshot_path), '_blank')}>View Screenshot</Button>
                  )}
                </Stack>
              </Box>
              <Box>
                <Typography variant="h6" gutterBottom>Employee Information</Typography>
                <Stack spacing={1}>
                  <Typography><strong>Employee:</strong> {selectedClient.first_name ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'N/A'}</Typography>
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
              {selectedClient.submissions?.length > 0 && (
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
                              <Chip label={sub.status} color={sub.status === 'approved' ? 'success' : sub.status === 'pending' ? 'warning' : 'default'} size="small" />
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
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Refund Confirmation ── */}
      <Dialog open={refundConfirmOpen} onClose={() => { setRefundConfirmOpen(false); setRefundTarget(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Initiate Refund</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to initiate a refund for <strong>{refundTarget?.client_name}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will mark the submission as <strong>refunded</strong> and remove it from incentive totals and payroll calculations.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRefundConfirmOpen(false); setRefundTarget(null); }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmRefund}>Confirm Refund</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteTarget?.client_name}</strong>?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will permanently remove the client record and all associated incentive submissions. Payroll will be recalculated.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete Client</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
