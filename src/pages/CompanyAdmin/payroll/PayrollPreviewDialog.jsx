/**
 * PayrollPreviewDialog.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full salary-breakdown preview for a single payroll run item.
 * Features:
 *  • Earnings table with editable amounts (click pencil icon)
 *  • Deductions table with editable amounts
 *  • Incentive detail row (highlighted)
 *  • Adjustments section (list of manual bonus/deductions already added)
 *  • Live net-salary recalculation as user edits
 *  • Save to backend via PUT /payroll/run-items/:id/snapshot
 *  • Recalculate from scratch button
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Divider, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, Button,
  IconButton, TextField, Chip, CircularProgress, Tooltip,
  Alert, Grid, Skeleton, Badge,
} from '@mui/material';
import {
  Edit, Check, Close, Refresh, InfoOutlined,
  ArrowUpward, ArrowDownward, SaveAlt,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const fmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const round2 = (v) => Math.round(Number(v) * 100) / 100;

// ─── Editable amount cell ─────────────────────────────────────────────────────
function EditableAmountCell({ value, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  const startEdit = () => { setDraft(String(round2(value))); setEditing(true); };
  const cancel    = () => setEditing(false);
  const save      = () => {
    const n = Number(draft);
    if (isNaN(n) || n < 0) return;
    onSave(round2(n));
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 140 }}>
        <TextField
          size="small"
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          autoFocus
          inputProps={{ min: 0, step: 0.01, style: { padding: '4px 8px', width: 90 } }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1 } }}
        />
        <Tooltip title="Save">
          <IconButton size="small" onClick={save} color="success"><Check fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Cancel">
          <IconButton size="small" onClick={cancel}><Close fontSize="small" /></IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
      <Typography variant="body2" fontWeight={600}>{fmt(value)}</Typography>
      {!disabled && (
        <Tooltip title="Edit amount">
          <IconButton size="small" onClick={startEdit} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
            <Edit sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, total, color = '#1E293B', icon }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, bgcolor: color + '12', borderBottom: `2px solid ${color}20` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        <Typography fontWeight={700} fontSize="0.82rem" color={color} textTransform="uppercase" letterSpacing={0.8}>{label}</Typography>
      </Box>
      <Typography fontWeight={800} fontSize="0.9rem" color={color}>{fmt(total)}</Typography>
    </Box>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────
export default function PayrollPreviewDialog({ open, itemId, frozen, onClose, onSaved }) {
  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [earnings,       setEarnings]       = useState([]);
  const [deductions,     setDeductions]     = useState([]);
  const [dirty,          setDirty]          = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [recalculating,  setRecalculating]  = useState(false);
  const [error,          setError]          = useState('');

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError('');
    try {
      const d = await apiRequest(`/payroll/run-items/${itemId}`);
      setData(d);
      setEarnings((d.earnings_snapshot   || []).map(c => ({ ...c, amount: round2(c.amount) })));
      setDeductions((d.deductions_snapshot || []).map(c => ({ ...c, amount: round2(c.amount) })));
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  // Live totals
  const totalEarnings   = earnings.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalDeductions = deductions.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const adjustmentsNet  = (data?.adjustments || []).reduce(
    (s, a) => s + (a.adjustment_type === 'earning' ? 1 : -1) * Number(a.amount), 0,
  );
  const liveNet = round2(totalEarnings - totalDeductions + adjustmentsNet);

  const updateEarning   = (idx, val) => { const arr = [...earnings];   arr[idx] = { ...arr[idx], amount: val }; setEarnings(arr);   setDirty(true); };
  const updateDeduction = (idx, val) => { const arr = [...deductions]; arr[idx] = { ...arr[idx], amount: val }; setDeductions(arr); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/payroll/run-items/${itemId}/snapshot`, {
        method: 'PUT',
        body: { earnings_snapshot: earnings, deductions_snapshot: deductions },
      });
      setDirty(false);
      onSaved?.();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!window.confirm('Recalculate from attendance & incentive data? Your manual edits will be lost.')) return;
    setRecalculating(true);
    setError('');
    try {
      await apiRequest(`/payroll/run-items/${itemId}/recalculate`, { method: 'POST' });
      onSaved?.();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRecalculating(false);
    }
  };

  const isLocked = frozen || !!data?.frozen_at;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* ── Header ── */}
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', px: 3, py: 2.5, color: '#fff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>
                {loading ? <Skeleton width={180} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} /> : `${data?.first_name} ${data?.last_name}`}
              </Typography>
              <Typography sx={{ opacity: 0.7, fontSize: '0.8rem' }}>
                {loading ? <Skeleton width={120} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} /> : `${data?.employee_code} · ${data?.designation_title ?? ''} · ${data?.department_name ?? ''}`}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ opacity: 0.7, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 1 }}>Net Salary</Typography>
              <Typography variant="h5" fontWeight={900} sx={{ color: '#34D399' }}>
                {loading ? <Skeleton width={100} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} /> : fmt(liveNet)}
              </Typography>
              {dirty && <Chip label="Unsaved changes" size="small" sx={{ bgcolor: '#FBBF24', color: '#000', fontWeight: 700, fontSize: '0.65rem', mt: 0.5 }} />}
            </Box>
          </Box>

          {/* Attendance bar */}
          {data && (
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: 'Present', value: data.present_days, color: '#34D399' },
                { label: 'Absent',  value: data.absent_days,  color: '#F87171' },
                { label: 'Paid Leave', value: data.paid_leave_days, color: '#60A5FA' },
                { label: 'Unpaid Leave', value: data.unpaid_leave_days, color: '#FBBF24' },
                { label: 'Late (min)', value: data.late_minutes, color: '#FB923C' },
              ].map(({ label, value, color }) => (
                <Box key={label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ color, fontWeight: 800, fontSize: '1rem', lineHeight: 1 }}>{Number(value ?? 0)}</Typography>
                  <Typography sx={{ opacity: 0.6, fontSize: '0.65rem' }}>{label}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, bgcolor: '#F8FAFC' }}>
        {loading ? (
          <Box sx={{ p: 3 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={44} sx={{ mb: 0.5 }} />)}
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mx: 2, mt: 2, borderRadius: 2 }}>{error}</Alert>}

            {isLocked && (
              <Alert severity="info" icon={<InfoOutlined />} sx={{ mx: 2, mt: 2, borderRadius: 2 }}>
                This payroll is <strong>frozen</strong>. Component amounts cannot be edited.
              </Alert>
            )}

            {/* ── Summary Row ── */}
            <Grid container sx={{ px: 2, py: 1.5, gap: 1, bgcolor: '#fff', borderBottom: '1px solid #E2E8F0' }}>
              {[
                { label: 'Gross CTC', val: data?.ctc ?? 0, color: '#6366F1' },
                { label: 'Total Earnings', val: totalEarnings, color: '#059669' },
                { label: 'Incentives', val: data?.incentive_total ?? 0, color: '#F59E0B' },
                { label: 'Total Deductions', val: totalDeductions, color: '#DC2626' },
              ].map(({ label, val, color }) => (
                <Grid item key={label} xs>
                  <Box sx={{ textAlign: 'center', px: 1 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">{label}</Typography>
                    <Typography fontWeight={800} sx={{ color, fontSize: '0.95rem' }}>{fmt(val)}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* ── Earnings Table ── */}
            <Box sx={{ mt: 2, mx: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <SectionHeader
                label="Earnings"
                total={totalEarnings}
                color="#059669"
                icon={<ArrowUpward sx={{ fontSize: 16, color: '#059669' }} />}
              />
              <TableContainer component={Paper} elevation={0} square>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F0FDF4', fontSize: '0.75rem', color: '#166534' } }}>
                      <TableCell>Component</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {earnings.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No earnings components</TableCell></TableRow>
                    ) : earnings.map((comp, idx) => {
                      const isIncentive = comp.calculation_type === 'dynamic' || comp.component_code?.toLowerCase().includes('incentive');
                      return (
                        <TableRow
                          key={idx}
                          sx={{
                            bgcolor: isIncentive ? '#FFFBEB' : 'inherit',
                            '&:hover': { bgcolor: isIncentive ? '#FEF3C7' : '#F8FAFC' },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={500}>{comp.component_name}</Typography>
                              {isIncentive && (
                                <Chip label="Incentive" size="small" sx={{ bgcolor: '#F59E0B', color: '#fff', fontWeight: 700, height: 18, fontSize: '0.6rem' }} />
                              )}
                              {comp.is_taxable && (
                                <Chip label="Taxable" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem', borderColor: '#94A3B8', color: '#64748B' }} />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">{comp.component_code} · {comp.calculation_type}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label="Earning"
                              size="small"
                              sx={{ bgcolor: '#DCFCE7', color: '#166534', fontWeight: 600, height: 20, fontSize: '0.65rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <EditableAmountCell
                              value={comp.amount}
                              onSave={val => updateEarning(idx, val)}
                              disabled={isLocked || isIncentive}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* ── Deductions Table ── */}
            <Box sx={{ mt: 2, mx: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <SectionHeader
                label="Deductions"
                total={totalDeductions}
                color="#DC2626"
                icon={<ArrowDownward sx={{ fontSize: 16, color: '#DC2626' }} />}
              />
              <TableContainer component={Paper} elevation={0} square>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#FEF2F2', fontSize: '0.75rem', color: '#991B1B' } }}>
                      <TableCell>Component</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deductions.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No deduction components</TableCell></TableRow>
                    ) : deductions.map((comp, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#FEF2F2' } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{comp.component_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{comp.component_code} · {comp.calculation_type}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label="Deduction"
                            size="small"
                            sx={{ bgcolor: '#FEE2E2', color: '#991B1B', fontWeight: 600, height: 20, fontSize: '0.65rem' }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <EditableAmountCell
                            value={comp.amount}
                            onSave={val => updateDeduction(idx, val)}
                            disabled={isLocked}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* ── Manual Adjustments ── */}
            {(data?.adjustments?.length > 0) && (
              <Box sx={{ mt: 2, mx: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                <SectionHeader
                  label={`Manual Adjustments (${data.adjustments.length})`}
                  total={adjustmentsNet}
                  color="#6366F1"
                />
                <TableContainer component={Paper} elevation={0} square>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#EEF2FF', fontSize: '0.75rem', color: '#3730A3' } }}>
                        <TableCell>Label</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.adjustments.map((adj, idx) => (
                        <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#EEF2FF' } }}>
                          <TableCell><Typography variant="body2" fontWeight={600}>{adj.label}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{adj.reason}</Typography></TableCell>
                          <TableCell>
                            <Chip
                              label={adj.adjustment_type === 'earning' ? 'Bonus' : 'Deduction'}
                              size="small"
                              sx={{
                                bgcolor: adj.adjustment_type === 'earning' ? '#DCFCE7' : '#FEE2E2',
                                color: adj.adjustment_type === 'earning' ? '#166534' : '#991B1B',
                                fontWeight: 600, height: 20, fontSize: '0.65rem',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{ color: adj.adjustment_type === 'earning' ? '#059669' : '#DC2626' }}
                            >
                              {adj.adjustment_type === 'earning' ? '+' : '-'}{fmt(adj.amount)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* ── Net Salary Footer ── */}
            <Box sx={{
              mx: 2, mt: 2, mb: 2, p: 2.5,
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Net Salary Payable
                </Typography>
                <Typography sx={{ color: '#fff', fontSize: '0.78rem', opacity: 0.7, mt: 0.3 }}>
                  Earnings {fmt(totalEarnings)} − Deductions {fmt(totalDeductions)} {adjustmentsNet !== 0 ? `+ Adjustments ${fmt(adjustmentsNet)}` : ''}
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={900} sx={{ color: '#34D399' }}>
                {fmt(liveNet)}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      {/* ── Actions ── */}
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1, justifyContent: 'space-between' }}>
        <Tooltip title="Recalculate this employee's pay from scratch using latest attendance & incentive data">
          <span>
            <Button
              variant="outlined"
              startIcon={recalculating ? <CircularProgress size={14} /> : <Refresh />}
              onClick={handleRecalculate}
              disabled={recalculating || isLocked || loading}
              color="warning"
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {recalculating ? 'Recalculating…' : 'Recalculate'}
            </Button>
          </span>
        </Tooltip>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>Close</Button>
          {!isLocked && (
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveAlt />}
              onClick={handleSave}
              disabled={saving || !dirty || loading}
              sx={{ bgcolor: '#6366F1', '&:hover': { bgcolor: '#4F46E5' }, borderRadius: 2, fontWeight: 700 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
