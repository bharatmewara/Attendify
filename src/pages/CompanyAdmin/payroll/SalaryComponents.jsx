import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField,
  MenuItem, Alert, Snackbar, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Chip, Tooltip, Divider, Switch,
  FormControlLabel, CircularProgress, Skeleton, InputAdornment,
} from '@mui/material';
import {
  Add, Edit, Delete, Code, Percent, AttachMoney,
  FlashOn, TrendingDown, TrendingUp, CheckCircle,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const CALC_TYPES = [
  { value: 'fixed',      label: 'Fixed Amount',    icon: <AttachMoney sx={{ fontSize: 16 }} /> },
  { value: 'percentage', label: 'Percentage',       icon: <Percent sx={{ fontSize: 16 }} /> },
  { value: 'formula',    label: 'Formula',          icon: <Code sx={{ fontSize: 16 }} /> },
  { value: 'dynamic',    label: 'Dynamic (Incentive)', icon: <FlashOn sx={{ fontSize: 16 }} /> },
];

const TYPE_COLORS = {
  earning:   { color: '#059669', bg: '#ECFDF5', label: 'Earning' },
  deduction: { color: '#DC2626', bg: '#FEF2F2', label: 'Deduction' },
};

const EMPTY_FORM = {
  component_name: '',
  component_code: '',
  component_type: 'earning',
  calculation_type: 'fixed',
  default_value: 0,
  percentage_of: '',
  percentage_value: '',
  formula_expression: '',
  is_taxable: false,
  is_mandatory: true,
  display_order: 0,
};

export default function SalaryComponents() {
  const [components, setComponents] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [dialog,     setDialog]     = useState({ open: false, mode: 'create', data: null });
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(null);
  const [snack,      setSnack]      = useState({ open: false, msg: '', sev: 'success' });
  const [validating, setValidating] = useState(false);
  const [formulaOk,  setFormulaOk]  = useState(null);

  const loadComponents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/payroll/components');
      setComponents(data || []);
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadComponents(); }, [loadComponents]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormulaOk(null);
    setDialog({ open: true, mode: 'create', data: null });
  };

  const openEdit = (comp) => {
    setForm({
      component_name: comp.component_name,
      component_code: comp.component_code,
      component_type: comp.component_type,
      calculation_type: comp.calculation_type,
      default_value: comp.default_value ?? 0,
      percentage_of: comp.percentage_of ?? '',
      percentage_value: comp.percentage_value ?? '',
      formula_expression: comp.formula_expression ?? '',
      is_taxable: comp.is_taxable ?? false,
      is_mandatory: comp.is_mandatory ?? true,
      display_order: comp.display_order ?? 0,
      is_active: comp.is_active,
    });
    setFormulaOk(null);
    setDialog({ open: true, mode: 'edit', data: comp });
  };

  const handleValidateFormula = async () => {
    setValidating(true);
    try {
      const result = await apiRequest('/payroll/validate-formula', {
        method: 'POST',
        body: { expression: form.formula_expression },
      });
      setFormulaOk(result.valid);
      if (!result.valid) {
        setSnack({ open: true, msg: `Formula error: ${result.error}`, sev: 'error' });
      }
    } catch {
      setFormulaOk(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!form.component_name || !form.component_code) {
      setSnack({ open: true, msg: 'Name and code are required', sev: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (dialog.mode === 'create') {
        await apiRequest('/payroll/components', { method: 'POST', body: form });
        setSnack({ open: true, msg: 'Component created!', sev: 'success' });
      } else {
        await apiRequest(`/payroll/components/${dialog.data.id}`, { method: 'PUT', body: form });
        setSnack({ open: true, msg: 'Component updated!', sev: 'success' });
      }
      setDialog({ open: false });
      loadComponents();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this component? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await apiRequest(`/payroll/components/${id}`, { method: 'DELETE' });
      setSnack({ open: true, msg: 'Component deleted', sev: 'success' });
      loadComponents();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const earnings   = components.filter(c => c.component_type === 'earning');
  const deductions = components.filter(c => c.component_type === 'deduction');

  const ComponentTable = ({ items, type }) => {
    const cfg = TYPE_COLORS[type];
    return (
      <Card sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            {type === 'earning' ? <TrendingUp sx={{ color: cfg.color }} /> : <TrendingDown sx={{ color: cfg.color }} />}
            <Typography variant="h6" fontWeight={700} sx={{ color: cfg.color }}>
              {cfg.label}s
            </Typography>
            <Chip label={items.length} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
          </Box>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Calculation</TableCell>
                  <TableCell>Value / Formula</TableCell>
                  <TableCell>Taxable</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No {type}s defined yet</TableCell></TableRow>
                ) : items.map(comp => (
                  <TableRow key={comp.id} hover>
                    <TableCell>
                      <Typography fontWeight={600} variant="body2">{comp.component_name}</Typography>
                      {comp.is_mandatory && <Typography variant="caption" color="text.secondary">Mandatory</Typography>}
                    </TableCell>
                    <TableCell>
                      <code style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                        {comp.component_code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={CALC_TYPES.find(t => t.value === comp.calculation_type)?.label ?? comp.calculation_type}
                        size="small" variant="outlined"
                        sx={{ fontSize: '0.7rem', borderRadius: 1 }}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      {comp.calculation_type === 'fixed'      && `₹${Number(comp.default_value || 0).toLocaleString('en-IN')}`}
                      {comp.calculation_type === 'percentage' && `${comp.percentage_value}% of ${comp.percentage_of || 'basic'}`}
                      {comp.calculation_type === 'formula'    && <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{comp.formula_expression}</code>}
                      {comp.calculation_type === 'dynamic'    && 'From incentives'}
                    </TableCell>
                    <TableCell>
                      {comp.is_taxable ? <Chip label="Yes" size="small" color="warning" sx={{ fontSize: '0.7rem' }} /> : <Typography variant="caption" color="text.secondary">No</Typography>}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={comp.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={comp.is_active ? 'success' : 'default'}
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(comp)}><Edit fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(comp.id)} disabled={deleting === comp.id}>
                          {deleting === comp.id ? <CircularProgress size={14} /> : <Delete fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
            Salary Components
          </Typography>
          <Typography color="text.secondary">
            Define earnings and deduction components used in salary structures. Supports fixed, percentage, and formula-based calculation.
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ borderRadius: 2, px: 3, fontWeight: 700, flexShrink: 0 }}
        >
          Add Component
        </Button>
      </Box>

      {loading ? (
        [1,2,3,4].map(i => <Skeleton key={i} height={64} sx={{ mb: 1, borderRadius: 2 }} />)
      ) : (
        <>
          <ComponentTable items={earnings} type="earning" />
          <ComponentTable items={deductions} type="deduction" />
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {dialog.mode === 'create' ? 'Add Salary Component' : 'Edit Salary Component'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth label="Component Name" size="small" value={form.component_name}
                onChange={e => setForm(p => ({ ...p, component_name: e.target.value }))}
                placeholder="e.g. Basic Salary"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth label="Code" size="small" value={form.component_code}
                onChange={e => setForm(p => ({ ...p, component_code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))}
                placeholder="BASIC"
                helperText="Used in formulas"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Component Type" size="small" value={form.component_type}
                onChange={e => setForm(p => ({ ...p, component_type: e.target.value }))}
              >
                <MenuItem value="earning">Earning</MenuItem>
                <MenuItem value="deduction">Deduction</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth select label="Calculation Type" size="small" value={form.calculation_type}
                onChange={e => setForm(p => ({ ...p, calculation_type: e.target.value }))}
              >
                {CALC_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </TextField>
            </Grid>

            {form.calculation_type === 'fixed' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Fixed Amount" size="small" type="number" value={form.default_value}
                  onChange={e => setForm(p => ({ ...p, default_value: Number(e.target.value) }))}
                  InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                />
              </Grid>
            )}

            {form.calculation_type === 'percentage' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Percentage" size="small" type="number" value={form.percentage_value}
                    onChange={e => setForm(p => ({ ...p, percentage_value: e.target.value }))}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label="Percentage of (component code)" size="small" value={form.percentage_of}
                    onChange={e => setForm(p => ({ ...p, percentage_of: e.target.value }))}
                    placeholder="e.g. basic, gross, ctc"
                    helperText="Reference component by code"
                  />
                </Grid>
              </>
            )}

            {form.calculation_type === 'formula' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Formula Expression" size="small" value={form.formula_expression}
                  onChange={e => { setForm(p => ({ ...p, formula_expression: e.target.value })); setFormulaOk(null); }}
                  placeholder="e.g. basic * 0.4, hra + basic * 0.2"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={handleValidateFormula} disabled={validating}>
                          {validating ? <CircularProgress size={14} /> : 'Test'}
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Use component codes as variables. Supports +,-,*,/,( )"
                  color={formulaOk === true ? 'success' : formulaOk === false ? 'error' : 'primary'}
                />
                {formulaOk === true && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: '#059669' }}>
                    <CheckCircle sx={{ fontSize: 14 }} />
                    <Typography variant="caption">Formula is valid</Typography>
                  </Box>
                )}
              </Grid>
            )}

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth label="Display Order" size="small" type="number" value={form.display_order}
                    onChange={e => setForm(p => ({ ...p, display_order: Number(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={<Switch checked={form.is_taxable} onChange={e => setForm(p => ({ ...p, is_taxable: e.target.checked }))} size="small" />}
                    label={<Typography variant="body2">Taxable</Typography>}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={<Switch checked={form.is_mandatory} onChange={e => setForm(p => ({ ...p, is_mandatory: e.target.checked }))} size="small" />}
                    label={<Typography variant="body2">Mandatory</Typography>}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialog({ open: false })}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Create Component' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
