import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField,
  MenuItem, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, Divider, CircularProgress, Skeleton,
  InputAdornment, Avatar,
} from '@mui/material';
import { Add, Edit, PersonAdd, AccountBalance, History } from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const PAYMENT_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash' },
  { value: 'cheque',        label: 'Cheque' },
];

const STATUS_COLORS = {
  active:   { color: '#059669', bg: '#ECFDF5' },
  revised:  { color: '#D97706', bg: '#FEF3C7' },
  inactive: { color: '#6B7280', bg: '#F3F4F6' },
};

const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

const EMPTY_FORM = {
  employee_id: '',
  template_id: '',
  effective_from: new Date().toISOString().split('T')[0],
  ctc: '',
  gross_salary: '',
  payment_type: 'bank_transfer',
  bank_account: '',
  bank_ifsc: '',
  bank_name: '',
  notes: '',
};

export default function SalaryAssignment() {
  const [assignments, setAssignments] = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dialog,      setDialog]      = useState({ open: false, mode: 'create', data: null });
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [histDialog,  setHistDialog]  = useState({ open: false, data: [] });
  const [snack,       setSnack]       = useState({ open: false, msg: '', sev: 'success' });
  const [searchTerm,  setSearchTerm]  = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [asgn, emps, tmpl] = await Promise.all([
        apiRequest('/payroll/assignments'),
        apiRequest('/employees'),
        apiRequest('/payroll/templates'),
      ]);
      setAssignments(asgn || []);
      setEmployees(emps || []);
      setTemplates(tmpl || []);
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAssign = (emp = null) => {
    setForm({ ...EMPTY_FORM, employee_id: emp?.id ?? '' });
    setDialog({ open: true, mode: 'create', data: null });
  };

  const openEdit = (asgn) => {
    setForm({
      employee_id:  asgn.employee_id,
      template_id:  asgn.template_id,
      effective_from: asgn.effective_from?.split('T')[0] ?? '',
      ctc:          asgn.ctc ?? '',
      gross_salary: asgn.gross_salary ?? '',
      payment_type: asgn.payment_type ?? 'bank_transfer',
      bank_account: asgn.bank_account ?? '',
      bank_ifsc:    asgn.bank_ifsc ?? '',
      bank_name:    asgn.bank_name ?? '',
      notes:        asgn.notes ?? '',
    });
    setDialog({ open: true, mode: 'edit', data: asgn });
  };

  const openHistory = async (employeeId) => {
    try {
      const data = await apiRequest(`/payroll/assignments/${employeeId}`);
      setHistDialog({ open: true, data: data || [] });
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    }
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.template_id || !form.effective_from || !form.ctc) {
      setSnack({ open: true, msg: 'Employee, template, effective date, and CTC are required', sev: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (dialog.mode === 'create') {
        await apiRequest('/payroll/assignments', { method: 'POST', body: form });
        setSnack({ open: true, msg: 'Salary assigned successfully!', sev: 'success' });
      } else {
        await apiRequest(`/payroll/assignments/${dialog.data.id}`, { method: 'PUT', body: form });
        setSnack({ open: true, msg: 'Assignment updated!', sev: 'success' });
      }
      setDialog({ open: false });
      loadData();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Get unique active assignments (most recent per employee)
  const activeAssignments = assignments.filter(a => a.salary_status === 'active');

  const filtered = activeAssignments.filter(a =>
    !searchTerm ||
    `${a.first_name} ${a.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Employees without active assignments
  const unassigned = employees.filter(emp =>
    emp.status === 'active' && !activeAssignments.some(a => a.employee_id === emp.id),
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
            Employee Salary Assignment
          </Typography>
          <Typography color="text.secondary">
            Assign salary structure templates to employees with CTC and bank details
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<PersonAdd />} onClick={() => openAssign()}
          sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
        >
          Assign Salary
        </Button>
      </Box>

      {/* Unassigned employees warning */}
      {unassigned.length > 0 && (
        <Alert
          severity="warning" sx={{ mb: 3, borderRadius: 2 }}
          action={<Button size="small" onClick={() => openAssign(unassigned[0])}>Assign Now</Button>}
        >
          <strong>{unassigned.length} active employee{unassigned.length > 1 ? 's' : ''}</strong>{' '}
          {unassigned.length > 1 ? 'have' : 'has'} no salary assignment:
          {' '}{unassigned.slice(0, 3).map(e => `${e.first_name} ${e.last_name}`).join(', ')}
          {unassigned.length > 3 && ` +${unassigned.length - 3} more`}
        </Alert>
      )}

      {/* Search */}
      <TextField
        size="small" placeholder="Search employees…" value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        sx={{ mb: 3, width: 300 }}
      />

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Active Salary Assignments
          </Typography>
          {loading ? (
            [1,2,3].map(i => <Skeleton key={i} height={64} sx={{ mb: 1 }} />)
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                    <TableCell>Employee</TableCell>
                    <TableCell>Template</TableCell>
                    <TableCell>CTC</TableCell>
                    <TableCell>Gross</TableCell>
                    <TableCell>Payment Mode</TableCell>
                    <TableCell>Effective From</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {searchTerm ? 'No employees match your search' : 'No active assignments. Assign salaries to employees.'}
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(asgn => (
                    <TableRow key={asgn.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: '#6366F115', color: '#6366F1', fontSize: 14, fontWeight: 700 }}>
                            {asgn.first_name?.[0]}{asgn.last_name?.[0]}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{asgn.first_name} {asgn.last_name}</Typography>
                            <Typography variant="caption" color="text.secondary">{asgn.employee_code}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{asgn.template_name}</Typography>
                      </TableCell>
                      <TableCell><strong>{currency(asgn.ctc)}</strong></TableCell>
                      <TableCell>{currency(asgn.gross_salary)}</TableCell>
                      <TableCell>
                        <Chip
                          label={PAYMENT_TYPES.find(p => p.value === asgn.payment_type)?.label ?? asgn.payment_type}
                          size="small" variant="outlined"
                          icon={<AccountBalance sx={{ fontSize: '14px !important' }} />}
                        />
                      </TableCell>
                      <TableCell>
                        {asgn.effective_from ? new Date(asgn.effective_from).toLocaleDateString('en-IN') : '—'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button size="small" startIcon={<Edit sx={{ fontSize: 13 }} />} onClick={() => openEdit(asgn)}>Revise</Button>
                          <Button size="small" startIcon={<History sx={{ fontSize: 13 }} />} onClick={() => openHistory(asgn.employee_id)}>History</Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Assign / Revise Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialog.mode === 'create' ? 'Assign Salary Structure' : 'Revise Salary Assignment'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Employee" size="small" value={form.employee_id}
                onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}
                disabled={dialog.mode === 'edit'}
              >
                {employees.filter(e => e.status === 'active').map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Salary Template" size="small" value={form.template_id}
                onChange={e => setForm(p => ({ ...p, template_id: e.target.value }))}
              >
                {templates.filter(t => t.is_active).map(t => (
                  <MenuItem key={t.id} value={t.id}>{t.template_name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Effective From" type="date" size="small" value={form.effective_from}
                onChange={e => setForm(p => ({ ...p, effective_from: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Annual CTC" type="number" size="small" value={form.ctc}
                onChange={e => setForm(p => ({ ...p, ctc: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Monthly Gross" type="number" size="small" value={form.gross_salary}
                onChange={e => setForm(p => ({ ...p, gross_salary: e.target.value }))}
                InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                helperText="Defaults to CTC/12 if blank"
              />
            </Grid>

            <Grid item xs={12}><Divider><Typography variant="caption" color="text.secondary">Bank Details</Typography></Divider></Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth select label="Payment Type" size="small" value={form.payment_type}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
              >
                {PAYMENT_TYPES.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Bank Account No." size="small" value={form.bank_account}
                onChange={e => setForm(p => ({ ...p, bank_account: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="IFSC Code" size="small" value={form.bank_ifsc}
                onChange={e => setForm(p => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Bank Name" size="small" value={form.bank_name}
                onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Notes" size="small" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes about this revision"
              />
            </Grid>
          </Grid>

          {dialog.mode === 'create' && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
              Creating a new assignment will deactivate the existing one and create a revision record.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialog({ open: false })}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Assign Salary' : 'Revise Assignment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={histDialog.open} onClose={() => setHistDialog({ open: false, data: [] })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Salary Revision History</DialogTitle>
        <Divider />
        <DialogContent>
          {histDialog.data.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No history found</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700 } }}>
                    <TableCell>Effective From</TableCell>
                    <TableCell>Template</TableCell>
                    <TableCell>CTC</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {histDialog.data.map(h => (
                    <TableRow key={h.id}>
                      <TableCell>{h.effective_from ? new Date(h.effective_from).toLocaleDateString('en-IN') : '—'}</TableCell>
                      <TableCell>{h.template_name}</TableCell>
                      <TableCell>{currency(h.ctc)}</TableCell>
                      <TableCell>
                        <Chip
                          label={h.salary_status}
                          size="small"
                          sx={{
                            fontSize: '0.7rem', fontWeight: 600,
                            bgcolor: STATUS_COLORS[h.salary_status]?.bg ?? '#F3F4F6',
                            color:   STATUS_COLORS[h.salary_status]?.color ?? '#6B7280',
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setHistDialog({ open: false, data: [] })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
