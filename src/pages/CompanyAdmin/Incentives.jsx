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
import { Check, Close, Edit, Info, MoreVert, Visibility } from '@mui/icons-material';
import { API_BASE_URL, apiRequest } from '../../lib/api';
import IncentiveRulesManager from '../../components/IncentiveRulesManager';

const uploadsBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

const productOptions = [
  'Bulk SMS',
  'WhatsApp SMS',
  'WhatsApp Meta Setup',
  'WhatsApp Meta Recharge',
  'WhatsApp Meta Subscription',
  'RCS Setup',
  'RCS Recharge',
];

const toScreenshotUrl = (screenshotPath) => {
  if (!screenshotPath) return '';

  const normalized = String(screenshotPath).replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  const relative = (idx >= 0 ? normalized.slice(idx) : normalized).replace(/^\/+/, '');

  return `${uploadsBaseUrl}/${relative}`;
};

const normalizeNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export default function IncentivesManagement() {
  const [requests, setRequests] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const now = useMemo(() => new Date(), []);
  const [earningsMonth, setEarningsMonth] = useState(now.getMonth() + 1);
  const [earningsYear, setEarningsYear] = useState(now.getFullYear());

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [menuRow, setMenuRow] = useState(null);

  const [perfMonth, setPerfMonth] = useState(now.getMonth() + 1);
  const [perfYear, setPerfYear] = useState(now.getFullYear());
  const [performanceEmployees, setPerformanceEmployees] = useState([]);
  const [performanceDialogOpen, setPerformanceDialogOpen] = useState(false);
  const [performanceDetails, setPerformanceDetails] = useState(null);

  const [tierDraft, setTierDraft] = useState([]);
  const [targetsMonth, setTargetsMonth] = useState(now.getMonth() + 1);
  const [targetsYear, setTargetsYear] = useState(now.getFullYear());
  const [targetSalesAmount, setTargetSalesAmount] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState(''); // empty => all employees

  const [rulesText, setRulesText] = useState('');
  const [rulesSource, setRulesSource] = useState('');
  const [rulesLoading, setRulesLoading] = useState(false);

  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  const loadQueue = async () => {
    try {
      const req = await apiRequest('/incentives/submissions');
      setRequests(req || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadEmployees = async () => {
    try {
      const rows = await apiRequest('/employees');
      setEmployees(rows || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadPerformance = async (month = perfMonth, year = perfYear) => {
    try {
      const qs = new URLSearchParams();
      qs.set('month', String(month));
      qs.set('year', String(year));
      const data = await apiRequest(`/incentives/performance?${qs.toString()}`);
      setPerformanceEmployees(data?.employees || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const openPerformanceDetails = async (employeeId) => {
    try {
      const qs = new URLSearchParams();
      qs.set('month', String(perfMonth));
      qs.set('year', String(perfYear));
      qs.set('employee_id', String(employeeId));
      const data = await apiRequest(`/incentives/performance?${qs.toString()}`);
      setPerformanceDetails(data || null);
      setPerformanceDialogOpen(true);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const closePerformanceDetails = () => {
    setPerformanceDialogOpen(false);
    setPerformanceDetails(null);
  };

  const loadTargetTiers = async () => {
    try {
      const rows = await apiRequest('/incentives/targets/tiers');
      setTierDraft((rows || []).map((r) => ({ min_sales_amount: Number(r.min_sales_amount), target_total_salary: Number(r.target_total_salary) })));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadClients = async (q = clientQuery) => {
    try {
      setClientsLoading(true);
      const qs = new URLSearchParams();
      if (q) qs.set('q', q);
      const rows = await apiRequest(`/incentives/clients?${qs.toString()}`);
      setClients(rows || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setClientsLoading(false);
    }
  };

  const openClient = (row) => {
    setSelectedClient(row);
    setClientDialogOpen(true);
  };

  const closeClient = () => {
    setClientDialogOpen(false);
    setSelectedClient(null);
  };

  const saveTargetTiers = async () => {
    try {
      const tiers = (tierDraft || []).map((t) => ({
        min_sales_amount: Number(t.min_sales_amount),
        target_total_salary: Number(t.target_total_salary),
      }));
      await apiRequest('/incentives/targets/tiers', { method: 'PUT', body: { tiers } });
      setMessage({ type: 'success', text: 'Target tiers saved.' });
      await loadTargetTiers();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const loadDefaultTargetTiers = async () => {
    const defaults = [
      { min_sales_amount: 80000, target_total_salary: 11000 },
      { min_sales_amount: 120000, target_total_salary: 12000 },
      { min_sales_amount: 150000, target_total_salary: 15000 },
      { min_sales_amount: 180000, target_total_salary: 18000 },
      { min_sales_amount: 200000, target_total_salary: 20000 },
      { min_sales_amount: 250000, target_total_salary: 22000 },
    ];
    setTierDraft(defaults);
  };

  const loadIncentiveRules = async () => {
    try {
      setRulesLoading(true);
      const res = await apiRequest('/incentives/rules');
      setRulesSource(res?.source || '');
      setRulesText(JSON.stringify(res?.config || {}, null, 2));
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setRulesLoading(false);
    }
  };

  const saveIncentiveRules = async () => {
    try {
      const parsed = JSON.parse(rulesText || '{}');
      await apiRequest('/incentives/rules', { method: 'PUT', body: { config: parsed } });
      setMessage({ type: 'success', text: 'Incentive rules saved.' });
      await loadIncentiveRules();
    } catch (error) {
      setMessage({ type: 'error', text: `Rules save failed: ${error.message}` });
    }
  };

  const saveMonthlyTargets = async () => {
    try {
      const payload = {
        month: Number(targetsMonth),
        year: Number(targetsYear),
        target_sales_amount: Number(targetSalesAmount || 0),
        ...(targetEmployeeId ? { employee_id: Number(targetEmployeeId) } : {}),
      };
      await apiRequest('/incentives/targets/monthly', { method: 'PUT', body: payload });
      setMessage({ type: 'success', text: 'Monthly targets updated.' });
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
    loadEmployees();
    loadTargetTiers();
    loadPerformance(perfMonth, perfYear);
    loadClients('');
    loadIncentiveRules();
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

  const openEdit = (row) => {
    setEditForm({
      id: row.id,
      client_name: row.client_name || '',
      product_name: row.product_name || productOptions[0],
      package_type: row.package_type || 'new',
      payment_mode: row.payment_mode || '',
      client_location: row.client_location || '',
      client_mobile_1: row.client_mobile_1 || '',
      client_mobile_2: row.client_mobile_2 || '',
      client_email: row.client_email || '',
      client_username: row.client_username || '',
      client_panel_username: row.client_panel_username || '',
      client_panel_password: '',
      sms_quantity: row.sms_quantity ?? '',
      rate: row.rate ?? '',
      price: row.price ?? '',
      incentive_amount: row.incentive_amount ?? '',
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditForm(null);
  };

  const editRateInvalid = useMemo(() => {
    if (!editForm) return false;
    const needsRate = ['Bulk SMS', 'WhatsApp SMS'].includes(editForm.product_name);
    if (!needsRate) return false;
    if (editForm.rate === '' || editForm.rate === null || editForm.rate === undefined) return false;
    const r = Number(editForm.rate);
    return !Number.isFinite(r) || r < 0 || r >= 1;
  }, [editForm]);

  const saveEdit = async () => {
    if (!editForm) return;
    if (editRateInvalid) {
      setMessage({ type: 'error', text: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
      return;
    }

    try {
      const payload = {
        client_name: editForm.client_name,
        product_name: editForm.product_name,
        package_type: editForm.package_type,
        payment_mode: editForm.payment_mode,
        client_location: editForm.client_location,
        client_mobile_1: editForm.client_mobile_1,
        client_mobile_2: editForm.client_mobile_2,
        client_email: editForm.client_email,
        client_username: editForm.client_username,
        client_panel_username: editForm.client_panel_username,
        ...(editForm.client_panel_password ? { client_panel_password: editForm.client_panel_password } : {}),
        sms_quantity: normalizeNumberOrNull(editForm.sms_quantity),
        rate: normalizeNumberOrNull(editForm.rate),
        price: normalizeNumberOrNull(editForm.price),
        incentive_amount: normalizeNumberOrNull(editForm.incentive_amount),
      };

      await apiRequest(`/incentives/submissions/${editForm.id}`, {
        method: 'PUT',
        body: payload,
      });

      setMessage({ type: 'success', text: 'Incentive updated.' });
      closeEdit();
      await loadQueue();
      await loadEarnings(earningsMonth, earningsYear);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
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

    if (action === 'edit') {
      openEdit(row);
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
                    <TableCell align="right">Actions</TableCell>
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
                  ))}
                  {earnings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">No earnings for selected month.</Typography>
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
                <Typography variant="h6" fontWeight={800}>Employee Performance (Sales)</Typography>
                <Typography color="text.secondary">How many clients each employee closed and sales details.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  label="Month"
                  type="number"
                  value={perfMonth}
                  onChange={(e) => setPerfMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 12 }}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                />
                <TextField
                  size="small"
                  label="Year"
                  type="number"
                  value={perfYear}
                  onChange={(e) => setPerfYear(Number(e.target.value) || now.getFullYear())}
                  sx={{ width: { xs: '100%', sm: 140 } }}
                />
                <Button variant="contained" onClick={() => loadPerformance(perfMonth, perfYear)}>Load</Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Clients</TableCell>
                    <TableCell>New</TableCell>
                    <TableCell>Renew</TableCell>
                    <TableCell>Sales</TableCell>
                    <TableCell>Incentives</TableCell>
                    <TableCell align="right">Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performanceEmployees.map((row) => (
                    <TableRow key={row.employee_id}>
                      <TableCell>{row.first_name} {row.last_name} ({row.employee_code || 'N/A'})</TableCell>
                      <TableCell>{Number(row.clients_total || 0)}</TableCell>
                      <TableCell>{Number(row.new_count || 0)}</TableCell>
                      <TableCell>{Number(row.renew_count || 0)}</TableCell>
                      <TableCell>{Number(row.sales_total || 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentives_total || 0).toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openPerformanceDetails(row.employee_id)} aria-label="view performance">
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {performanceEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography variant="body2" color="text.secondary">No performance data for selected month.</Typography>
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
                <Typography variant="h6" fontWeight={800}>Clients</Typography>
                <Typography color="text.secondary">All clients secured (from incentive submissions) with search.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField
                  size="small"
                  label="Search (name/mobile/email)"
                  value={clientQuery}
                  onChange={(e) => setClientQuery(e.target.value)}
                  sx={{ minWidth: { xs: '100%', sm: 320 } }}
                />
                <Button variant="contained" onClick={() => loadClients(clientQuery)} disabled={clientsLoading}>Search</Button>
                <Button variant="outlined" onClick={() => { setClientQuery(''); loadClients(''); }} disabled={clientsLoading}>Reset</Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Panel User</TableCell>
                    <TableCell>Password</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Total Sales</TableCell>
                    <TableCell>Approved</TableCell>
                    <TableCell align="right">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.map((row) => (
                    <TableRow key={row.client_key}>
                      <TableCell>{row.client_name || 'N/A'}</TableCell>
                      <TableCell>{row.client_mobile_1 || 'N/A'}</TableCell>
                      <TableCell>{row.client_email || 'N/A'}</TableCell>
                      <TableCell>{row.client_panel_username || 'N/A'}</TableCell>
                      <TableCell>{row.client_panel_password ? '********' : 'N/A'}</TableCell>
                      <TableCell>{row.first_name ? `${row.first_name} ${row.last_name} (${row.employee_code || 'N/A'})` : 'N/A'}</TableCell>
                      <TableCell>{Number(row.total_sales || 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.approved_count || 0)}/{Number(row.submissions_count || 0)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="text" onClick={() => openClient(row)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <Typography variant="body2" color="text.secondary">No clients found.</Typography>
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
                <Typography variant="h6" fontWeight={800}>Targets & Salary Tiers</Typography>
                <Typography color="text.secondary">Set company tiers and monthly targets (all or per employee).</Typography>
              </Box>
              <Stack direction="row" spacing={1.25} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
                <Button variant="outlined" onClick={loadDefaultTargetTiers}>Load Defaults</Button>
                <Button variant="contained" onClick={saveTargetTiers}>Save Tiers</Button>
              </Stack>
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Min Sales</TableCell>
                    <TableCell>Target Salary</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(tierDraft || []).map((tier, idx) => (
                    <TableRow key={`${tier.min_sales_amount}-${idx}`}>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={tier.min_sales_amount}
                          onChange={(e) => {
                            const next = [...tierDraft];
                            next[idx] = { ...next[idx], min_sales_amount: e.target.value };
                            setTierDraft(next);
                          }}
                          inputProps={{ min: 0 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={tier.target_total_salary}
                          onChange={(e) => {
                            const next = [...tierDraft];
                            next[idx] = { ...next[idx], target_total_salary: e.target.value };
                            setTierDraft(next);
                          }}
                          inputProps={{ min: 0 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="text"
                          color="error"
                          onClick={() => setTierDraft((current) => current.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(tierDraft || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary">No tiers configured yet.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Button variant="outlined" onClick={() => setTierDraft((current) => [...(current || []), { min_sales_amount: 0, target_total_salary: 0 }])}>
                Add Tier
              </Button>
              <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />
              <Typography fontWeight={700}>Monthly Target</Typography>
              <TextField
                size="small"
                label="Month"
                type="number"
                value={targetsMonth}
                onChange={(e) => setTargetsMonth(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                inputProps={{ min: 1, max: 12 }}
                sx={{ width: { xs: '100%', sm: 120 } }}
              />
              <TextField
                size="small"
                label="Year"
                type="number"
                value={targetsYear}
                onChange={(e) => setTargetsYear(Number(e.target.value) || now.getFullYear())}
                sx={{ width: { xs: '100%', sm: 140 } }}
              />
              <TextField
                size="small"
                select
                label="Employee"
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name} ({e.employee_code || 'N/A'})</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Target Sales"
                type="number"
                value={targetSalesAmount}
                onChange={(e) => setTargetSalesAmount(e.target.value)}
                inputProps={{ min: 0 }}
                sx={{ width: { xs: '100%', sm: 160 } }}
              />
              <Button variant="contained" onClick={saveMonthlyTargets}>Save Target</Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Incentive Rules Manager</Typography>
                <Typography color="text.secondary">Edit products + incentive calculations. Source: {rulesSource || 'default'}.</Typography>
              </Box>
              <Stack direction="row" spacing={1.25} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                <Button variant="outlined" onClick={loadIncentiveRules} disabled={rulesLoading}>
                  Reload
                </Button>
                <Button variant="contained" onClick={saveIncentiveRules} disabled={rulesLoading}>
                  Save Rules
                </Button>
              </Stack>
            </Stack>

            <Box sx={{ mt: 2 }}>
              <IncentiveRulesManager rulesText={rulesText} onRulesChange={setRulesText} />
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              After saving, employee submit forms use these rules. If you disable a product, employees cannot submit it.
            </Alert>
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
        <MenuItem onClick={() => handleMenuAction('edit')}>
          <Edit fontSize="small" style={{ marginRight: 10 }} />
          Edit
        </MenuItem>
        {menuRow?.status === 'pending' ? (
          <MenuItem onClick={() => handleMenuAction('approve')}>
            <Check fontSize="small" style={{ marginRight: 10 }} />
            Approve
          </MenuItem>
        ) : null}
        {menuRow?.status === 'pending' ? (
          <MenuItem onClick={() => handleMenuAction('reject')}>
            <Close fontSize="small" style={{ marginRight: 10 }} />
            Reject
          </MenuItem>
        ) : null}
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
              <Typography><b>Client Panel Username:</b> {selected.client_panel_username || 'N/A'}</Typography>
              <Typography><b>Client Panel Password:</b> {selected.client_panel_password ? '********' : 'N/A'}</Typography>
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

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="md" fullWidth>
        <DialogTitle>Edit Incentive</DialogTitle>
        <DialogContent dividers>
          {editForm ? (
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField fullWidth label="Client Name" value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} />
                <TextField fullWidth select label="Product" value={editForm.product_name} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}>
                  {productOptions.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField fullWidth select label="Type" value={editForm.package_type} onChange={(e) => setEditForm({ ...editForm, package_type: e.target.value })}>
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="renew">Renew</MenuItem>
                </TextField>
                <TextField fullWidth label="Payment Mode" value={editForm.payment_mode} onChange={(e) => setEditForm({ ...editForm, payment_mode: e.target.value })} />
                <TextField fullWidth label="Client Location" value={editForm.client_location} onChange={(e) => setEditForm({ ...editForm, client_location: e.target.value })} />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField fullWidth label="Client Mobile 1" value={editForm.client_mobile_1} onChange={(e) => setEditForm({ ...editForm, client_mobile_1: e.target.value })} />
                <TextField fullWidth label="Client Mobile 2" value={editForm.client_mobile_2} onChange={(e) => setEditForm({ ...editForm, client_mobile_2: e.target.value })} />
                <TextField fullWidth label="Client Email" value={editForm.client_email} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} />
                <TextField fullWidth label="Client Username" value={editForm.client_username} onChange={(e) => setEditForm({ ...editForm, client_username: e.target.value })} />
                <TextField fullWidth label="Client Panel Username" value={editForm.client_panel_username} onChange={(e) => setEditForm({ ...editForm, client_panel_username: e.target.value })} />
                <TextField fullWidth label="Client Panel Password" type="password" value={editForm.client_panel_password} onChange={(e) => setEditForm({ ...editForm, client_panel_password: e.target.value })} helperText="Leave blank to keep existing password." />
              </Stack>

              {['Bulk SMS', 'WhatsApp SMS'].includes(editForm.product_name) ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField fullWidth label="SMS Quantity" type="number" value={editForm.sms_quantity} onChange={(e) => setEditForm({ ...editForm, sms_quantity: e.target.value })} />
                  <TextField
                    fullWidth
                    label="Rate"
                    type="number"
                    value={editForm.rate}
                    onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                    error={editRateInvalid}
                    helperText={editRateInvalid ? 'Enter paisa rate like 0.12 (must be < 1).' : 'Example: 0.12'}
                    inputProps={{ step: '0.01', min: 0, max: 0.9999 }}
                  />
                </Stack>
              ) : null}

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField fullWidth label="Price" type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                <TextField fullWidth label="Incentive Amount" type="number" value={editForm.incentive_amount} onChange={(e) => setEditForm({ ...editForm, incentive_amount: e.target.value })} helperText="Leave blank to auto-calculate on save." />
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm || editRateInvalid}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={performanceDialogOpen} onClose={closePerformanceDetails} maxWidth="md" fullWidth>
        <DialogTitle>Employee Performance</DialogTitle>
        <DialogContent dividers>
          {performanceDetails ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                <Box>
                  <Typography fontWeight={800}>
                    {performanceDetails.employee?.first_name} {performanceDetails.employee?.last_name} ({performanceDetails.employee?.employee_code || 'N/A'})
                  </Typography>
                  <Typography color="text.secondary">
                    {new Date(performanceDetails.year, performanceDetails.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`Clients: ${Number(performanceDetails.summary?.clients_total || 0)}`} />
                  <Chip label={`New: ${Number(performanceDetails.summary?.new_count || 0)}`} />
                  <Chip label={`Renew: ${Number(performanceDetails.summary?.renew_count || 0)}`} />
                  <Chip color="primary" label={`Sales: ${Number(performanceDetails.summary?.sales_total || 0).toLocaleString()}`} />
                  <Chip color="success" label={`Incentives: ${Number(performanceDetails.summary?.incentives_total || 0).toFixed(2)}`} />
                </Stack>
              </Stack>

              <Divider />

              <Typography variant="subtitle2" fontWeight={800}>Approved Sales Details</Typography>
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
                    {(performanceDetails.details || []).map((row) => (
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
                    {(performanceDetails.details || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography variant="body2" color="text.secondary">No approved sales found.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePerformanceDetails}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={clientDialogOpen} onClose={closeClient} maxWidth="sm" fullWidth>
        <DialogTitle>Client Info</DialogTitle>
        <DialogContent dividers>
          {selectedClient ? (
            <Stack spacing={1.25}>
              <Typography><b>Client:</b> {selectedClient.client_name || 'N/A'}</Typography>
              <Typography><b>Mobile 1:</b> {selectedClient.client_mobile_1 || 'N/A'}</Typography>
              <Typography><b>Mobile 2:</b> {selectedClient.client_mobile_2 || 'N/A'}</Typography>
              <Typography><b>Email:</b> {selectedClient.client_email || 'N/A'}</Typography>
              <Divider />
              <Typography><b>Client Username:</b> {selectedClient.client_username || 'N/A'}</Typography>
              <Typography><b>Panel Username:</b> {selectedClient.client_panel_username || 'N/A'}</Typography>
              <Typography><b>Panel Password:</b> {selectedClient.client_panel_password || 'N/A'}</Typography>
              <Divider />
              <Typography><b>Total Sales:</b> {Number(selectedClient.total_sales || 0).toLocaleString()}</Typography>
              <Typography><b>Total Incentive:</b> {Number(selectedClient.total_incentive || 0).toFixed(2)}</Typography>
              <Typography><b>Approved / Submitted:</b> {Number(selectedClient.approved_count || 0)}/{Number(selectedClient.submissions_count || 0)}</Typography>
              <Divider />
              <Typography><b>Last Product:</b> {selectedClient.last_product || 'N/A'}</Typography>
              <Typography><b>Last Payment Mode:</b> {selectedClient.last_payment_mode || 'N/A'}</Typography>
              <Typography><b>Last Location:</b> {selectedClient.last_location || 'N/A'}</Typography>
              <Typography><b>Last Employee:</b> {selectedClient.first_name ? `${selectedClient.first_name} ${selectedClient.last_name} (${selectedClient.employee_code || 'N/A'})` : 'N/A'}</Typography>
              <Typography><b>Last Date:</b> {selectedClient.last_approved_at ? new Date(selectedClient.last_approved_at).toLocaleString() : selectedClient.last_submitted_at ? new Date(selectedClient.last_submitted_at).toLocaleString() : 'N/A'}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeClient}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
