import { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Close,
  Visibility,
  Download,
  InsertDriveFile,
  Replay,
  Delete,
  MoreVert,
  KeyboardArrowDown,
  KeyboardArrowUp,
  Repeat,
  ShoppingBag,
  AccessTime,
  CalendarToday,
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

// Row-level action menu
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

// Dual-scrollbar container
function TopScrollTableContainer({ children }) {
  const topRef  = useRef(null);
  const bodyRef = useRef(null);

  const syncFromTop  = () => { if (bodyRef.current) bodyRef.current.scrollLeft = topRef.current.scrollLeft; };
  const syncFromBody = () => { if (topRef.current)  topRef.current.scrollLeft  = bodyRef.current.scrollLeft; };

  return (
    <Box sx={{ position: 'relative' }}>
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
        <Box sx={{ height: 1, minWidth: 1600 }} />
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        ref={bodyRef}
        onScroll={syncFromBody}
        sx={{
          borderRadius: 0,
          overflowX: 'auto',
          '& .MuiTableHead-root .MuiTableRow-root': { position: 'sticky', top: 0, zIndex: 2 },
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
  const [repeatOnly,        setRepeatOnly]        = useState(false);
  const [expandedRows,      setExpandedRows]      = useState({});
  const [message,           setMessage]           = useState({ type: '', text: '' });
  const [clientDialogOpen,  setClientDialogOpen]  = useState(false);
  const [selectedClient,    setSelectedClient]    = useState(null);
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false);
  const [refundTarget,      setRefundTarget]      = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget,      setDeleteTarget]      = useState(null);

  const loadClients = async (q = clientQuery, from = dateFrom, to = dateTo, repeat = repeatOnly) => {
    try {
      setClientsLoading(true);
      const qs = new URLSearchParams();
      if (q)      qs.set('q', q);
      if (from)   qs.set('date_from', from);
      if (to)     qs.set('date_to', to);
      if (repeat) qs.set('repeat_only', 'true');

      const rows = await apiRequest(`/incentives/clients?${qs.toString()}`);
      setClients(rows || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setClientsLoading(false);
    }
  };

  const toggleExpand = (clientKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [clientKey]: !prev[clientKey],
    }));
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
    loadClients(clientQuery, from, to, repeatOnly);
  };

  const handleReset = () => {
    setClientQuery('');
    setDateFrom('');
    setDateTo('');
    setRepeatOnly(false);
    loadClients('', '', '', false);
  };

  useEffect(() => {
    loadClients(clientQuery, dateFrom, dateTo, repeatOnly);
  }, [repeatOnly]);

  const handleExportCsv = () => {
    const filename = `clients${dateFrom ? `_${dateFrom}` : ''}${dateTo ? `_to_${dateTo}` : ''}${repeatOnly ? '_repeat' : ''}.csv`;
    exportRowsToCsv(clients, [
      { label: 'Name',                    value: 'client_name' },
      { label: 'Mobile no',               value: 'client_mobile_1' },
      { label: 'Mobile no 2',             value: 'client_mobile_2' },
      { label: 'Email',                   value: 'client_email' },
      { label: 'Is Repeat Client',        value: (r) => r.is_repeat_client ? 'Yes' : 'No' },
      { label: 'Total Purchases',         value: (r) => r.total_purchases || r.submissions_count || 1 },
      { label: 'Repeat Interval (days)',  value: (r) => r.repeat_interval_days != null ? r.repeat_interval_days : '—' },
      { label: 'First Purchase Date',     value: 'first_purchase_date' },
      { label: 'Latest Purchase Date',    value: 'latest_purchase_date' },
      { label: 'Total Sales (excl GST)',  value: (r) => r.total_sales ?? 0 },
      { label: 'Total Received (incl GST)',value: (r) => r.total_received ?? 0 },
      { label: 'Product',                 value: (r) => r.last_product || r.product_name || '' },
      { label: 'Employee By',             value: (r) => r.first_name ? `${r.first_name} ${r.last_name}` : '' },
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

  const repeatCount = clients.filter(c => c.is_repeat_client).length;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" fontWeight={800} mb={1}>Clients Database & Analytics</Typography>
      <Typography color="text.secondary" mb={3}>
        Hierarchical client purchase history, repetition interval tracking, and revenue attribution.
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Unique Clients</Typography>
              <Typography variant="h5" fontWeight={800} color="primary.main">{clients.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Repeat Clients</Typography>
              <Typography variant="h5" fontWeight={800} color="success.main">{repeatCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Repeat Ratio</Typography>
              <Typography variant="h5" fontWeight={800} color="info.main">
                {clients.length > 0 ? `${Math.round((repeatCount / clients.length) * 100)}%` : '0%'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Total Revenue Received</Typography>
              <Typography variant="h5" fontWeight={800} color="#7C3AED">
                {RUPEE}{formatMoney(clients.reduce((sum, c) => sum + Number(c.total_received || 0), 0))}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
        <CardContent sx={{ p: 2.5 }}>
          {/* Header & Export */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>All Client Records</Typography>
              <Typography variant="body2" color="text.secondary">
                Click any row chevron to expand the full chronological order history.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="success"
              startIcon={<Download />}
              onClick={handleExportCsv}
              disabled={clients.length === 0}
            >
              Export CSV
            </Button>
          </Stack>

          {/* Quick Date Presets */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            {['today','week','month','last_month','quarter','year'].map((v) => (
              <Chip
                key={v}
                label={{ today:'Today', week:'This Week', month:'This Month', last_month:'Last Month', quarter:'This Quarter', year:'This Year' }[v]}
                onClick={() => applyQuickRange(v)}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>

          {/* Filter Bar */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <TextField size="small" label="From Date" type="date" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} sx={{ width: 150 }} />
            <TextField size="small" label="To Date"   type="date" InputLabelProps={{ shrink: true }} value={dateTo}   onChange={e => setDateTo(e.target.value)}   sx={{ width: 150 }} />
            <TextField size="small" label="Search (name/mobile/email)" value={clientQuery} onChange={e => setClientQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadClients()} sx={{ width: 230 }} />
            <Button variant="contained" onClick={() => loadClients()} disabled={clientsLoading}>Search</Button>
            <Button variant="outlined"  onClick={handleReset}         disabled={clientsLoading}>Reset</Button>

            {/* Repeat Clients Only Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={repeatOnly}
                  onChange={(e) => setRepeatOnly(e.target.checked)}
                  color="secondary"
                />
              }
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Repeat fontSize="small" color="secondary" />
                  <Typography variant="body2" fontWeight={600}>Repeat Only</Typography>
                </Stack>
              }
              sx={{ ml: 1 }}
            />
          </Stack>

          {/* Table */}
          <Box sx={{ mt: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <TopScrollTableContainer>
              <Table size="small" sx={{ minWidth: 1500 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ width: 40 }} />
                    <TableCell>Client Name</TableCell>
                    <TableCell>Client Type</TableCell>
                    <TableCell align="center">Purchases</TableCell>
                    <TableCell align="right">Repeat Interval</TableCell>
                    <TableCell>Latest Product</TableCell>
                    <TableCell align="right">Latest Received</TableCell>
                    <TableCell align="right">Total Received</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Handled By</TableCell>
                    <TableCell>First Purchase</TableCell>
                    <TableCell>Latest Purchase</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map((row) => {
                    const isExpanded = Boolean(expandedRows[row.client_key]);
                    return (
                      <>
                        <TableRow key={row.client_key} hover sx={{ '& > *': { borderBottom: isExpanded ? 'unset' : undefined } }}>
                          <TableCell>
                            <IconButton size="small" onClick={() => toggleExpand(row.client_key)}>
                              {isExpanded ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {row.client_name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {row.is_repeat_client ? (
                              <Chip
                                label={`Repeat (${row.total_purchases || row.submissions_count}x)`}
                                color="success"
                                size="small"
                                sx={{ fontWeight: 700 }}
                              />
                            ) : (
                              <Chip label="New" size="small" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight={600}>
                              {row.total_purchases || row.submissions_count || 1}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {row.repeat_interval_days != null ? (
                              <Chip
                                label={`${row.repeat_interval_days} days avg`}
                                size="small"
                                color="info"
                                variant="outlined"
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.last_product || 'N/A'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {row.last_amount_received != null ? `${RUPEE}${formatMoney(row.last_amount_received)}` : 'N/A'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: '#15803D' }}>
                            {`${RUPEE}${formatMoney(row.total_received ?? row.total_sales ?? 0)}`}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_mobile_1 || 'N/A'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.client_email || 'N/A'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.first_name ? `${row.first_name} ${row.last_name}` : 'N/A'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.first_purchase_date ? new Date(row.first_purchase_date).toLocaleDateString('en-IN') : '—'}
                          </TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {row.latest_purchase_date ? new Date(row.latest_purchase_date).toLocaleDateString('en-IN') : '—'}
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

                        {/* Collapsible Hierarchical Order History */}
                        <TableRow key={`${row.client_key}-details`}>
                          <TableCell colSpan={14} sx={{ p: 0, bgcolor: '#F8FAFC' }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ p: 2.5, m: 1.5, bgcolor: '#FFFFFF', borderRadius: 2, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
                                  <Box>
                                    <Typography variant="subtitle2" fontWeight={800} color="primary">
                                      Chronological Purchase History — {row.client_name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Stable Identifier: {row.client_key} • {row.purchases?.length || 0} order records logged
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip label={`Total Sales: ${RUPEE}${formatMoney(row.total_sales || 0)}`} size="small" variant="outlined" />
                                    <Chip label={`Total Received: ${RUPEE}${formatMoney(row.total_received || 0)}`} size="small" color="success" sx={{ fontWeight: 600 }} />
                                    {row.average_purchase_value > 0 && (
                                      <Chip label={`Avg Order: ${RUPEE}${formatMoney(row.average_purchase_value)}`} size="small" color="primary" variant="outlined" />
                                    )}
                                    {row.repeat_interval_days != null && (
                                      <Chip label={`Repeat Cadence: ${row.repeat_interval_days} days`} size="small" color="secondary" />
                                    )}
                                  </Stack>
                                </Stack>

                                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                                  <Table size="small">
                                    <TableHead sx={{ bgcolor: '#F1F5F9' }}>
                                      <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.72rem' } }}>
                                        <TableCell>Order Ref</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Product</TableCell>
                                        <TableCell>Package</TableCell>
                                        <TableCell align="right">SMS Qty</TableCell>
                                        <TableCell align="right">Rate</TableCell>
                                        <TableCell align="right">Net Price</TableCell>
                                        <TableCell align="right">Received (incl GST)</TableCell>
                                        <TableCell align="right">Incentive</TableCell>
                                        <TableCell>Payment Mode</TableCell>
                                        <TableCell>Handled By</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="center">Proof</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {row.purchases?.map((order) => (
                                        <TableRow key={order.id} hover>
                                          <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                            {order.order_reference}
                                          </TableCell>
                                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                            {order.date ? new Date(order.date).toLocaleDateString('en-IN') : '—'}
                                          </TableCell>
                                          <TableCell sx={{ fontWeight: 600 }}>{order.product_name}</TableCell>
                                          <TableCell>
                                            <Chip size="small" label={order.package_type} variant="outlined" sx={{ textTransform: 'capitalize' }} />
                                          </TableCell>
                                          <TableCell align="right">{order.sms_quantity ?? '—'}</TableCell>
                                          <TableCell align="right">{order.rate != null ? order.rate : '—'}</TableCell>
                                          <TableCell align="right">{`${RUPEE}${formatMoney(order.price)}`}</TableCell>
                                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                                            {`${RUPEE}${formatMoney(order.price_gross || order.price)}`}
                                          </TableCell>
                                          <TableCell align="right" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                                            {`${RUPEE}${formatMoney(order.incentive_amount)}`}
                                          </TableCell>
                                          <TableCell>{order.payment_mode || '—'}</TableCell>
                                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{order.employee_name || 'Staff'}</TableCell>
                                          <TableCell>
                                            <Chip
                                              size="small"
                                              label={order.status}
                                              color={
                                                order.status === 'approved' ? 'success' :
                                                order.status === 'pending' ? 'warning' :
                                                order.status === 'refunded' ? 'secondary' : 'error'
                                              }
                                            />
                                          </TableCell>
                                          <TableCell align="center">
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                              {order.kyc_path && (
                                                <Tooltip title="View KYC">
                                                  <IconButton size="small" onClick={() => window.open(toScreenshotUrl(order.kyc_path), '_blank')}>
                                                    <InsertDriveFile fontSize="small" color="primary" />
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                              {order.screenshot_path && (
                                                <Tooltip title="View Payment Proof">
                                                  <IconButton size="small" onClick={() => window.open(toScreenshotUrl(order.screenshot_path), '_blank')}>
                                                    <Visibility fontSize="small" color="action" />
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                            </Stack>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })}

                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {clientsLoading ? 'Loading clients…' : 'No clients found matching filters.'}
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

      {/* Client Details Dialog */}
      <Dialog open={clientDialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Client Hierarchy & Profile</Typography>
            <IconButton onClick={closeDialog}><Close /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedClient && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Client Overview</Typography>
                    <Typography><strong>Name:</strong> {selectedClient.client_name || 'N/A'}</Typography>
                    <Typography><strong>Mobile 1:</strong> {selectedClient.client_mobile_1 || 'N/A'}</Typography>
                    <Typography><strong>Mobile 2:</strong> {selectedClient.client_mobile_2 || 'N/A'}</Typography>
                    <Typography><strong>Email:</strong> {selectedClient.client_email || 'N/A'}</Typography>
                    <Typography><strong>Location:</strong> {selectedClient.last_location || 'N/A'}</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>Repetition Metrics</Typography>
                    <Typography><strong>Status:</strong> {selectedClient.is_repeat_client ? 'Repeat Client' : 'New Client'}</Typography>
                    <Typography><strong>Total Orders:</strong> {selectedClient.total_purchases || selectedClient.submissions_count || 1}</Typography>
                    <Typography><strong>Total Received:</strong> {`${RUPEE}${formatMoney(selectedClient.total_received ?? 0)}`}</Typography>
                    <Typography><strong>Average Order:</strong> {`${RUPEE}${formatMoney(selectedClient.average_purchase_value ?? 0)}`}</Typography>
                    <Typography>
                      <strong>Repeat Interval:</strong> {selectedClient.repeat_interval_days != null ? `${selectedClient.repeat_interval_days} days` : 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Order history table inside dialog */}
              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Complete Order Hierarchy</Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                      <TableRow>
                        <TableCell>Order Ref</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Incentive</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedClient.purchases?.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{p.order_reference}</TableCell>
                          <TableCell>{p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</TableCell>
                          <TableCell>{p.product_name}</TableCell>
                          <TableCell align="right">{`${RUPEE}${formatMoney(p.price_gross || p.price)}`}</TableCell>
                          <TableCell align="right" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                            {`${RUPEE}${formatMoney(p.incentive_amount)}`}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={p.status} color={p.status === 'approved' ? 'success' : 'default'} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Refund Confirmation */}
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

      {/* Delete Confirmation */}
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
