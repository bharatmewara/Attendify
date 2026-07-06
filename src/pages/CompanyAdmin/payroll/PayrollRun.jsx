import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Button, Grid, Alert, Snackbar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Divider, CircularProgress, Skeleton, Avatar, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Stepper, Step, StepLabel, Tooltip,
} from '@mui/material';
import {
  PlayArrow, CheckCircle, MonetizationOn,
  Refresh, ArrowBack, Add, Visibility,
  Send, Print, BarChart,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';
import PayrollPreviewDialog from './PayrollPreviewDialog';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const STATUS_STEPS = ['draft', 'processing', 'approved', 'paid'];
const STATUS_LABELS = { draft: 'Draft', processing: 'Processing', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled' };

const STATUS_CFG = {
  draft:      { color: '#6B7280', bg: '#F3F4F6' },
  processing: { color: '#2563EB', bg: '#EFF6FF' },
  approved:   { color: '#059669', bg: '#ECFDF5' },
  paid:       { color: '#0D9488', bg: '#F0FDFA' },
  cancelled:  { color: '#DC2626', bg: '#FEF2F2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderRadius: 99, fontSize: '0.72rem', fontWeight: 600, color: cfg.color, bgcolor: cfg.bg }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
      {STATUS_LABELS[status] ?? status}
    </Box>
  );
}

export default function PayrollRun() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cycle,       setCycle]       = useState(null);
  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [running,     setRunning]     = useState(false);
  const [approving,   setApproving]   = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [adjDialog,   setAdjDialog]   = useState({ open: false, item: null });
  const [adjForm,     setAdjForm]     = useState({ adjustment_type: 'earning', label: '', reason: '', amount: '' });
  const [savingAdj,   setSavingAdj]   = useState(false);
  const [snack,       setSnack]       = useState({ open: false, msg: '', sev: 'success' });

  // ── Preview dialog state ──────────────────────────────────────────────────
  const [preview, setPreview] = useState({ open: false, itemId: null });

  const loadCycle = useCallback(async () => {
    setLoading(true);
    try {
      const [cycleData, itemsData] = await Promise.all([
        apiRequest(`/payroll/cycles/${id}`),
        apiRequest(`/payroll/cycles/${id}/items`),
      ]);
      setCycle(cycleData);
      setItems(itemsData || []);
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCycle(); }, [loadCycle]);

  const handleRun = async () => {
    if (!window.confirm('Run payroll for all active employees? This will calculate salaries based on attendance and incentives.')) return;
    setRunning(true);
    try {
      const result = await apiRequest(`/payroll/cycles/${id}/run`, { method: 'POST' });
      setSnack({ open: true, msg: `Payroll processed: ${result.processed} employees (${result.skipped} skipped)`, sev: result.errors?.length ? 'warning' : 'success' });
      loadCycle();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Approve and freeze this payroll? No changes will be possible after approval.')) return;
    setApproving(true);
    try {
      await apiRequest(`/payroll/cycles/${id}/approve`, { method: 'POST' });
      setSnack({ open: true, msg: 'Payroll approved and frozen!', sev: 'success' });
      loadCycle();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setApproving(false);
    }
  };

  const handleMarkPaid = async () => {
    const sendEmails = window.confirm('Send salary credit email notifications to all employees?');
    setPaying(true);
    try {
      await apiRequest(`/payroll/cycles/${id}/mark-paid`, { method: 'POST', body: { send_emails: sendEmails } });
      setSnack({ open: true, msg: 'Payroll marked as paid!', sev: 'success' });
      loadCycle();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleSaveAdjustment = async () => {
    if (!adjForm.label || !adjForm.reason || !adjForm.amount) {
      setSnack({ open: true, msg: 'All fields are required', sev: 'error' });
      return;
    }
    setSavingAdj(true);
    try {
      await apiRequest(`/payroll/run-items/${adjDialog.item.id}/adjust`, { method: 'PUT', body: adjForm });
      setSnack({ open: true, msg: 'Adjustment applied!', sev: 'success' });
      setAdjDialog({ open: false, item: null });
      loadCycle();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setSavingAdj(false);
    }
  };

  const totals = items.reduce((acc, item) => ({
    gross: acc.gross + Number(item.gross_salary || 0),
    net:   acc.net   + Number(item.net_salary   || 0),
    incentives: acc.incentives + Number(item.incentive_total || 0),
    deductions: acc.deductions + Number(item.total_deductions || 0),
  }), { gross: 0, net: 0, incentives: 0, deductions: 0 });

  const stepIndex = STATUS_STEPS.indexOf(cycle?.status);

  if (loading) return (
    <Box sx={{ p: 4 }}>
      <Skeleton height={48} sx={{ mb: 2 }} />
      <Skeleton height={200} sx={{ mb: 2 }} />
      {[1,2,3].map(i => <Skeleton key={i} height={64} sx={{ mb: 1 }} />)}
    </Box>
  );

  if (!cycle) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography color="error">Payroll cycle not found</Typography>
      <Button onClick={() => navigate('/app/payroll')} sx={{ mt: 2 }}>Back to Payroll</Button>
    </Box>
  );

  const frozen = cycle.status === 'approved' || cycle.status === 'paid' || cycle.status === 'cancelled';
  const periodLabel = `${MONTH_NAMES[cycle.cycle_month - 1]} ${cycle.cycle_year}`;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/app/payroll')}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A' }}>
            {periodLabel} Payroll
          </Typography>
          <Typography color="text.secondary">
            {new Date(cycle.period_start).toLocaleDateString('en-IN')} – {new Date(cycle.period_end).toLocaleDateString('en-IN')}
          </Typography>
        </Box>
        <StatusBadge status={cycle.status} />
      </Box>

      {/* Progress Stepper */}
      {cycle.status !== 'cancelled' && (
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent sx={{ px: 4, py: 3 }}>
            <Stepper activeStep={Math.max(0, stepIndex)} alternativeLabel>
              {STATUS_STEPS.map((s, i) => (
                <Step key={s} completed={i < stepIndex}>
                  <StepLabel>{STATUS_LABELS[s]}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card sx={{ borderRadius: 3, mb: 3, background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#fff' }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h6" fontWeight={700}>{items.length} Employees Processed</Typography>
              <Typography sx={{ opacity: 0.8, mt: 0.5 }}>
                Gross: {currency(totals.gross)} · Net: {currency(totals.net)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}>
                <Button
                  variant="contained"
                  startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
                  onClick={handleRun} disabled={running || frozen}
                  sx={{ bgcolor: '#6366F1', '&:hover': { bgcolor: '#4F46E5' }, borderRadius: 2, fontWeight: 700 }}
                >
                  {running ? 'Running…' : items.length > 0 ? 'Re-run Payroll' : 'Run Payroll'}
                </Button>
                {cycle.status === 'draft' && items.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={approving ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                    onClick={handleApprove} disabled={approving}
                    sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' }, borderRadius: 2, fontWeight: 700 }}
                  >
                    {approving ? 'Approving…' : 'Approve Payroll'}
                  </Button>
                )}
                {cycle.status === 'approved' && (
                  <Button
                    variant="contained"
                    startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <MonetizationOn />}
                    onClick={handleMarkPaid} disabled={paying}
                    sx={{ bgcolor: '#0D9488', '&:hover': { bgcolor: '#0F766E' }, borderRadius: 2, fontWeight: 700 }}
                  >
                    {paying ? 'Processing…' : 'Mark as Paid'}
                  </Button>
                )}
                <Tooltip title="Refresh data">
                  <IconButton onClick={loadCycle} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                    <Refresh />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Gross', value: currency(totals.gross),      color: '#3B82F6' },
          { label: 'Total Net',   value: currency(totals.net),        color: '#059669' },
          { label: 'Incentives',  value: currency(totals.incentives), color: '#F59E0B' },
          { label: 'Deductions',  value: currency(totals.deductions), color: '#DC2626' },
        ].map(({ label, value, color }) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <Card sx={{ borderRadius: 2, borderLeft: `4px solid ${color}` }}>
              <CardContent sx={{ py: 2, px: 2.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">{label}</Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color }}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {frozen && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }} icon={<CheckCircle />}>
          This payroll cycle is <strong>{cycle.status}</strong> and frozen. No further changes can be made.
          {cycle.approved_by && ` Approved by: ${cycle.approved_by_email}`}
        </Alert>
      )}

      {/* Employee Payroll Table */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Employee Payroll Details</Typography>
            {items.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Click <BarChart sx={{ fontSize: 13, verticalAlign: 'middle' }} /> to preview & edit salary breakdown
              </Typography>
            )}
          </Box>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC', fontSize: '0.78rem' } }}>
                  <TableCell>Employee</TableCell>
                  <TableCell>Attendance</TableCell>
                  <TableCell align="right">Earnings</TableCell>
                  <TableCell align="right">Incentives</TableCell>
                  <TableCell align="right">Deductions</TableCell>
                  <TableCell align="right">Net Salary</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Box sx={{ color: 'text.secondary' }}>
                        <PlayArrow sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                        <Typography>Click "Run Payroll" to calculate employee salaries</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : items.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 30, height: 30, bgcolor: '#6366F115', color: '#6366F1', fontSize: 12, fontWeight: 700 }}>
                          {item.first_name?.[0]}{item.last_name?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600} lineHeight={1.2}>{item.first_name} {item.last_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.employee_code}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {Number(item.present_days)}P / {Number(item.absent_days)}A / {Number(item.paid_leave_days)}L
                      </Typography>
                      {Number(item.unpaid_leave_days) > 0 && (
                        <Typography variant="caption" color="error" display="block">
                          {Number(item.unpaid_leave_days)} unpaid leave
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{currency(item.total_earnings)}</TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#F59E0B' }}>
                          {currency(item.incentive_total)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#DC2626' }}>{currency(item.total_deductions)}</TableCell>
                    <TableCell align="right"><strong style={{ color: '#059669' }}>{currency(item.net_salary)}</strong></TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                      {item.frozen_at && <Typography variant="caption" color="text.secondary" display="block">Frozen</Typography>}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {/* ── Preview / Edit Breakdown ── */}
                        <Tooltip title="Preview & Edit Salary Breakdown">
                          <IconButton
                            size="small"
                            onClick={() => setPreview({ open: true, itemId: item.id })}
                            sx={{ color: '#6366F1', bgcolor: '#EEF2FF', '&:hover': { bgcolor: '#E0E7FF' } }}
                          >
                            <BarChart fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {!frozen && (
                          <Tooltip title="Add Manual Adjustment">
                            <IconButton size="small" onClick={() => { setAdjDialog({ open: true, item }); setAdjForm({ adjustment_type: 'earning', label: '', reason: '', amount: '' }); }}>
                              <Add fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Payslip">
                          <IconButton size="small" onClick={() => navigate(`/app/payroll/payslip/${item.id}`)}>
                            <Print fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* ── Salary Preview Dialog ── */}
      <PayrollPreviewDialog
        open={preview.open}
        itemId={preview.itemId}
        frozen={frozen}
        onClose={() => setPreview({ open: false, itemId: null })}
        onSaved={() => {
          setSnack({ open: true, msg: 'Salary components saved!', sev: 'success' });
          loadCycle();
        }}
      />

      {/* Adjustment Dialog */}
      <Dialog open={adjDialog.open} onClose={() => setAdjDialog({ open: false, item: null })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Add Adjustment — {adjDialog.item?.first_name} {adjDialog.item?.last_name}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Type" size="small" value={adjForm.adjustment_type}
                onChange={e => setAdjForm(p => ({ ...p, adjustment_type: e.target.value }))}
              >
                <MenuItem value="earning">Earning (adds to net)</MenuItem>
                <MenuItem value="deduction">Deduction (subtracts from net)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Amount (₹)" type="number" size="small" value={adjForm.amount}
                onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Label" size="small" value={adjForm.label}
                onChange={e => setAdjForm(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Festival Bonus, Advance Deduction"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Reason" size="small" multiline rows={2} value={adjForm.reason}
                onChange={e => setAdjForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Reason for this adjustment"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setAdjDialog({ open: false, item: null })}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSaveAdjustment} disabled={savingAdj}
            startIcon={savingAdj ? <CircularProgress size={14} color="inherit" /> : null}
            color={adjForm.adjustment_type === 'deduction' ? 'error' : 'primary'}
          >
            {savingAdj ? 'Saving…' : 'Apply Adjustment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
