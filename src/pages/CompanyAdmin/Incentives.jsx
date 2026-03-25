import { useEffect, useMemo, useState } from 'react';
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
  Divider,
  IconButton,
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
import { Check, Close, Info, MoreVert } from '@mui/icons-material';
import { API_BASE_URL, apiRequest } from '../../lib/api';

const uploadsBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

const toScreenshotUrl = (screenshotPath) => {
  if (!screenshotPath) return '';

  const normalized = String(screenshotPath).replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  const relative = (idx >= 0 ? normalized.slice(idx) : normalized).replace(/^\/+/, '');

  return `${uploadsBaseUrl}/${relative}`;
};

export default function IncentivesManagement() {
  const [requests, setRequests] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const now = useMemo(() => new Date(), []);
  const [earningsMonth, setEarningsMonth] = useState(now.getMonth() + 1);
  const [earningsYear, setEarningsYear] = useState(now.getFullYear());

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuRow, setMenuRow] = useState(null);

  const loadQueue = async () => {
    try {
      const req = await apiRequest('/incentives/submissions');
      setRequests(req || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadEarnings = async (month = earningsMonth, year = earningsYear) => {
    try {
      const qs = new URLSearchParams();
      if (month) qs.set('month', String(month));
      if (year) qs.set('year', String(year));
      const rows = await apiRequest(`/incentives/earnings?${qs.toString()}`);
      setEarnings(rows || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadQueue();
    loadEarnings(earningsMonth, earningsYear);
  }, []);

  const queueRows = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const pendingCount = queueRows.length;

  const earningsTotal = useMemo(
    () => earnings.reduce((sum, r) => sum + Number(r.incentive_amount || 0), 0),
    [earnings],
  );

  const handleUpdateStatus = async (id, status) => {
    try {
      await apiRequest(`/incentives/submissions/${id}/status`, {
        method: 'PUT',
        body: { status },
      });
      setMessage({ type: 'success', text: `Request ${status}.` });
      await loadQueue();
      await loadEarnings(earningsMonth, earningsYear);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const openDetails = (row) => {
    setSelected(row);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelected(null);
  };

  const openRowMenu = (event, row) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuRow(row);
  };

  const closeRowMenu = () => {
    setMenuAnchorEl(null);
    setMenuRow(null);
  };

  const handleMenuAction = async (action) => {
    const row = menuRow;
    closeRowMenu();

    if (!row) return;

    if (action === 'details') {
      openDetails(row);
      return;
    }

    if (action === 'approve') {
      await handleUpdateStatus(row.id, 'approved');
      return;
    }

    if (action === 'reject') {
      await handleUpdateStatus(row.id, 'rejected');
    }
  };

  const isMenuOpen = Boolean(menuAnchorEl);
  const menuId = 'incentive-row-actions';

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {message.text ? <Alert severity={message.type || 'info'}>{message.text}</Alert> : null}

        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={800}>Incentive Management</Typography>
                <Typography color="text.secondary">Approve pending incentive submissions and track monthly earnings.</Typography>
              </Box>
              <Chip color={pendingCount ? 'warning' : 'success'} label={`Pending Requests: ${pendingCount}`} />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Request Queue (Pending)</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>Incentive</TableCell>
                    <TableCell>Screenshot</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueRows.map((row) => {
                    const screenshotUrl = toScreenshotUrl(row.screenshot_path);

                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.first_name} {row.last_name}</TableCell>
                        <TableCell>{row.client_name}</TableCell>
                        <TableCell>{row.product_name}</TableCell>
                        <TableCell>{Number(row.price || 0).toLocaleString()}</TableCell>
                        <TableCell>{String(row.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</TableCell>
                        <TableCell>{row.client_location || 'N/A'}</TableCell>
                        <TableCell>{row.client_mobile_1 || 'N/A'}</TableCell>
                        <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {row.screenshot_path ? (
                            <Button size="small" variant="text" href={screenshotUrl} target="_blank" rel="noreferrer">View</Button>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label="actions"
                            aria-controls={isMenuOpen ? menuId : undefined}
                            aria-haspopup="true"
                            onClick={(e) => openRowMenu(e, row)}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {queueRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <Typography variant="body2" color="text.secondary">No pending requests.</Typography>
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
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Monthly Incentive Info</Typography>
                <Typography color="text.secondary">Monitor incentives earned month-wise.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  label="Month"
                  type="number"
                  value={earningsMonth}
                  onChange={(e) => setEarningsMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 12 }}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                />
                <TextField
                  size="small"
                  label="Year"
                  type="number"
                  value={earningsYear}
                  onChange={(e) => setEarningsYear(Number(e.target.value) || now.getFullYear())}
                  sx={{ width: { xs: '100%', sm: 140 } }}
                />
                <Button variant="contained" onClick={() => loadEarnings(earningsMonth, earningsYear)}>Load</Button>
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <Chip color="success" label={`Total Earned: ${earningsTotal.toFixed(2)}`} />
              <Chip variant="outlined" label={`Rows: ${earnings.length}`} />
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Incentive Earned</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Payment Mode</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {earnings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.first_name} {row.last_name}</TableCell>
                      <TableCell>{row.client_name}</TableCell>
                      <TableCell>{Number(row.incentive_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>{String(row.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</TableCell>
                      <TableCell>{row.payment_mode || 'N/A'}</TableCell>
                      <TableCell>{row.earned_at ? new Date(row.earned_at).toLocaleString() : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {earnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary">No earnings for selected month.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Menu
        id={menuId}
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={closeRowMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => handleMenuAction('details')}>
          <Info fontSize="small" style={{ marginRight: 10 }} />
          Details
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('approve')}>
          <Check fontSize="small" style={{ marginRight: 10 }} />
          Approve
        </MenuItem>
        <MenuItem onClick={() => handleMenuAction('reject')}>
          <Close fontSize="small" style={{ marginRight: 10 }} />
          Reject
        </MenuItem>
      </Menu>

      <Dialog open={detailsOpen} onClose={closeDetails} maxWidth="sm" fullWidth>
        <DialogTitle>Incentive Submission Details</DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Stack spacing={1.25}>
              <Typography><b>Employee:</b> {selected.first_name} {selected.last_name}</Typography>
              <Divider />
              <Typography><b>Client:</b> {selected.client_name}</Typography>
              <Typography><b>Product:</b> {selected.product_name}</Typography>
              <Typography><b>Type:</b> {String(selected.package_type || '').toLowerCase() === 'renew' ? 'Renew' : 'New'}</Typography>
              <Typography><b>Client Location:</b> {selected.client_location || 'N/A'}</Typography>
              <Divider />
              <Typography><b>Client Mobile 1:</b> {selected.client_mobile_1 || 'N/A'}</Typography>
              <Typography><b>Client Mobile 2:</b> {selected.client_mobile_2 || 'N/A'}</Typography>
              <Typography><b>Client Email:</b> {selected.client_email || 'N/A'}</Typography>
              <Typography><b>Client User Name:</b> {selected.client_username || 'N/A'}</Typography>
              <Divider />
              <Typography><b>Quantity:</b> {selected.sms_quantity ?? 'N/A'}</Typography>
              <Typography><b>Rate:</b> {selected.rate ?? 'N/A'}</Typography>
              <Typography><b>Price:</b> {selected.price ?? 'N/A'}</Typography>
              <Typography><b>Payment Mode:</b> {selected.payment_mode || 'N/A'}</Typography>
              <Typography><b>Calculated Incentive:</b> {Number(selected.incentive_amount || 0).toFixed(2)}</Typography>
              <Typography><b>Status:</b> {selected.status}</Typography>
              <Typography><b>Submitted At:</b> {selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : 'N/A'}</Typography>
              <Typography><b>Screenshot:</b> {selected.screenshot_path ? (
                <Button size="small" variant="text" href={toScreenshotUrl(selected.screenshot_path)} target="_blank" rel="noreferrer">Open</Button>
              ) : 'N/A'}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetails}>Close</Button>
          {selected?.status === 'pending' ? (
            <>
              <Button variant="contained" color="success" onClick={() => { handleUpdateStatus(selected.id, 'approved'); closeDetails(); }}>Approve</Button>
              <Button variant="outlined" color="error" onClick={() => { handleUpdateStatus(selected.id, 'rejected'); closeDetails(); }}>Reject</Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  );
}