import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, TextField,
  MenuItem, Grid, Alert, Skeleton, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
  Avatar, IconButton, Tooltip,
} from '@mui/material';
import {
  Search, People, Phone, Email, LocationOn, Close,
  AccountCircle, Lock, ContentCopy, Visibility, VisibilityOff,
  InsertDriveFile,
} from '@mui/icons-material';
import { apiRequest, API_BASE_URL } from '../../lib/api';

const uploadsBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
const toUrl = (p) => {
  if (!p) return '';
  const n = String(p).replace(/\\/g, '/');
  const idx = n.indexOf('uploads/');
  return `${uploadsBaseUrl}/${(idx >= 0 ? n.slice(idx) : n).replace(/^\/+/, '')}`;
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_CFG = {
  pending:  { color: '#D97706', bg: '#FEF3C7', label: 'Pending' },
  approved: { color: '#059669', bg: '#ECFDF5', label: 'Approved' },
  rejected: { color: '#DC2626', bg: '#FEF2F2', label: 'Rejected' },
  paid:     { color: '#0D9488', bg: '#F0FDFA', label: 'Paid' },
  refunded: { color: '#7C3AED', bg: '#EDE9FE', label: 'Refunded' },
};

const money = (v) => v != null && v !== '' ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';
const fmt   = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? { color: '#6B7280', bg: '#F3F4F6', label: status };
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.4, borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, color: cfg.color, bgcolor: cfg.bg }}>
      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: cfg.color }} />
      {cfg.label}
    </Box>
  );
}

// ── Copy-to-clipboard button ───────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={copy} sx={{ ml: 0.5 }}>
        <ContentCopy sx={{ fontSize: 13, color: copied ? '#059669' : '#94A3B8' }} />
      </IconButton>
    </Tooltip>
  );
}

// ── Masked password field with show/hide toggle ────────────────────────────
function PasswordField({ value }) {
  const [show, setShow] = useState(false);
  if (!value) return <Typography variant="body2" color="text.secondary">—</Typography>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" fontWeight={600} fontFamily="monospace" letterSpacing={1}>
        {show ? value : '••••••••'}
      </Typography>
      <Tooltip title={show ? 'Hide' : 'Show'}>
        <IconButton size="small" onClick={() => setShow(!show)}>
          {show ? <VisibilityOff sx={{ fontSize: 14 }} /> : <Visibility sx={{ fontSize: 14 }} />}
        </IconButton>
      </Tooltip>
      <CopyBtn text={value} />
    </Box>
  );
}

// ── Detail info row ────────────────────────────────────────────────────────
function InfoRow({ label, value, icon, highlight }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 0.75 }}>
      {icon && <Box sx={{ mt: 0.2, color: '#94A3B8', flexShrink: 0 }}>{icon}</Box>}
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.2}>{label}</Typography>
        {typeof value === 'string' || typeof value === 'number'
          ? <Typography variant="body2" fontWeight={highlight ? 700 : 500} color={highlight ? '#059669' : 'text.primary'}>{value || '—'}</Typography>
          : value}
      </Box>
    </Box>
  );
}

export default function MyClients() {
  const now = new Date();
  const [clients,  setClients]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [month,    setMonth]    = useState('');
  const [year,     setYear]     = useState(now.getFullYear());
  const [status,   setStatus]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (month)  params.set('month', month);
      if (year)   params.set('year', year);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const data = await apiRequest(`/incentives/my-clients?${params}`);
      setClients(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [month, year, status, search]);

  useEffect(() => { load(); }, [load]);

  const totalEarnings = clients.reduce((s, c) => s + Number(c.incentive_amount || 0), 0);
  const approvedCount = clients.filter(c => c.status === 'approved' || c.status === 'paid').length;
  const pendingCount  = clients.filter(c => c.status === 'pending').length;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>My Clients</Typography>
        <Typography color="text.secondary">All clients you have submitted — including panel credentials</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* ── Summary Cards ── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Clients',    value: clients.length,       color: '#6366F1' },
          { label: 'Approved / Paid',  value: approvedCount,        color: '#059669' },
          { label: 'Pending Review',   value: pendingCount,         color: '#D97706' },
          { label: 'Total Incentives', value: money(totalEarnings), color: '#3B82F6' },
        ].map(({ label, value, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${color}`, height: '100%' }}>
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" display="block">{label}</Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.5 }}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Filters ── */}
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth size="small" placeholder="Search client name, mobile, email or product…"
                value={search} onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth select label="Month" size="small" value={month} onChange={e => setMonth(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                {MONTH_NAMES.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField fullWidth select label="Year" size="small" value={year} onChange={e => setYear(e.target.value)}>
                {[2024, 2025, 2026, 2027].map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth select label="Status" size="small" value={status} onChange={e => setStatus(e.target.value)}>
                <MenuItem value="">All Status</MenuItem>
                {Object.entries(STATUS_CFG).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Clients Table ── */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            [1,2,3,4].map(i => <Skeleton key={i} height={56} sx={{ mb: 1 }} />)
          ) : clients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <People sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6" fontWeight={600}>No clients found</Typography>
              <Typography>Submit a new client from the Today Status page to see it here.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{
              borderRadius: 2,
              overflowX: 'auto',
              '& .MuiTableHead-root .MuiTableCell-root': {
                position: 'sticky', top: 0, bgcolor: '#F8FAFC', zIndex: 2,
                boxShadow: 'inset 0 -2px 0 #E2E8F0',
              },
            }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' } }}>
                    <TableCell>Client</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Panel Username</TableCell>
                    <TableCell>Panel Password</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Incentive</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map(c => (
                    <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: '#6366F115', color: '#6366F1', fontSize: 13, fontWeight: 700 }}>
                            {c.client_name?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{c.client_name}</Typography>
                            {c.client_location && <Typography variant="caption" color="text.secondary">{c.client_location}</Typography>}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">{c.client_mobile_1 || '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">{c.client_email || ''}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onClick={e => e.stopPropagation()}>
                          <Typography variant="body2" fontFamily="monospace">{c.client_panel_username || '—'}</Typography>
                          {c.client_panel_username && <CopyBtn text={c.client_panel_username} />}
                        </Box>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <PasswordField value={c.client_panel_password} />
                      </TableCell>
                      <TableCell><Typography variant="body2">{c.product_name}</Typography></TableCell>
                      <TableCell>
                        <Chip label={c.package_type} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell align="right">{money(c.price_gross ?? c.price)}</TableCell>
                      <TableCell align="right" sx={{ color: '#059669', fontWeight: 600 }}>{money(c.incentive_amount)}</TableCell>
                      <TableCell><Typography variant="caption">{fmt(c.submitted_at)}</Typography></TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell>
                        <Button size="small" onClick={e => { e.stopPropagation(); setSelected(c); }}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Client Detail Dialog ── */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        {selected && (
          <>
            <DialogTitle sx={{ p: 0 }}>
              <Box sx={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', px: 3, py: 2.5, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ width: 44, height: 44, bgcolor: '#6366F130', color: '#A5B4FC', fontWeight: 800, fontSize: 18 }}>
                    {selected.client_name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={800} fontSize="1.05rem">{selected.client_name}</Typography>
                    <StatusBadge status={selected.status} />
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => setSelected(null)} sx={{ color: '#fff' }}><Close /></IconButton>
              </Box>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
              {/* ── Panel Credentials (highlighted) ── */}
              {(selected.client_panel_username || selected.client_panel_password) && (
                <Box sx={{ mb: 3, p: 2, bgcolor: '#EEF2FF', borderRadius: 2, border: '1px solid #C7D2FE' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#3730A3" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Lock fontSize="small" /> Panel Credentials
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary" display="block">Username</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={700} fontFamily="monospace">{selected.client_panel_username || '—'}</Typography>
                        {selected.client_panel_username && <CopyBtn text={selected.client_panel_username} />}
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary" display="block">Password</Typography>
                      <PasswordField value={selected.client_panel_password} />
                    </Grid>
                  </Grid>
                </Box>
              )}

              <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Contact Info</Typography></Divider>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <InfoRow label="Mobile" value={selected.client_mobile_1} icon={<Phone fontSize="small" />} />
                  {selected.client_mobile_2 && <InfoRow label="Mobile 2" value={selected.client_mobile_2} icon={<Phone fontSize="small" />} />}
                </Grid>
                {selected.client_email && (
                  <Grid item xs={12} sm={6}>
                    <InfoRow label="Email" value={selected.client_email} icon={<Email fontSize="small" />} />
                  </Grid>
                )}
                {selected.client_location && (
                  <Grid item xs={12} sm={6}>
                    <InfoRow label="Location" value={selected.client_location} icon={<LocationOn fontSize="small" />} />
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Sale Details</Typography></Divider>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {[
                  { label: 'Product',         value: selected.product_name },
                  { label: 'Package Type',     value: selected.package_type },
                  { label: 'Amount',           value: money(selected.price_gross ?? selected.price) },
                  { label: 'Incentive Earned', value: money(selected.incentive_amount), highlight: true },
                  { label: 'SMS Quantity',     value: selected.sms_quantity ?? '—' },
                  { label: 'Rate',             value: selected.rate != null ? `₹${selected.rate}` : '—' },
                  { label: 'Payment Mode',     value: selected.payment_mode || '—' },
                  { label: 'Submitted On',     value: fmt(selected.submitted_at) },
                ].map(({ label, value, highlight }) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                    <Typography fontWeight={highlight ? 700 : 500} color={highlight ? '#059669' : 'text.primary'} variant="body2">{value}</Typography>
                  </Grid>
                ))}
              </Grid>

              {/* KYC / Screenshot */}
              {(selected.kyc_path || selected.screenshot_path) && (
                <>
                  <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">Documents</Typography></Divider>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
                    {selected.kyc_path && (
                      <Button size="small" variant="outlined" startIcon={<InsertDriveFile />} onClick={() => window.open(toUrl(selected.kyc_path), '_blank')}>
                        View KYC
                      </Button>
                    )}
                    {selected.screenshot_path && (
                      <Button size="small" variant="outlined" startIcon={<InsertDriveFile />} onClick={() => window.open(toUrl(selected.screenshot_path), '_blank')}>
                        View Screenshot
                      </Button>
                    )}
                  </Box>
                </>
              )}

              {selected.notes && (
                <>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" color="text.secondary">Notes / Reason</Typography>
                  <Box sx={{ mt: 0.5, p: 1.5, bgcolor: '#F8FAFC', borderRadius: 1 }}>
                    <Typography variant="body2">{selected.notes}</Typography>
                  </Box>
                </>
              )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setSelected(null)} variant="outlined" sx={{ borderRadius: 2 }}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
