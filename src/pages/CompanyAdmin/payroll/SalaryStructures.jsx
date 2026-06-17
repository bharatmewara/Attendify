import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField,
  Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, Tooltip, Divider, CircularProgress,
  Skeleton, List, ListItem, ListItemText, ListItemSecondaryAction,
  Accordion, AccordionSummary, AccordionDetails, Checkbox,
} from '@mui/material';
import {
  Add, Edit, Delete, ExpandMore, DragIndicator,
  AccountTree, CheckCircle, RemoveCircle,
} from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const TYPE_COLORS = {
  earning:   { color: '#059669', bg: '#ECFDF5' },
  deduction: { color: '#DC2626', bg: '#FEF2F2' },
};

export default function SalaryStructures() {
  const [templates,   setTemplates]   = useState([]);
  const [components,  setComponents]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dialog,      setDialog]      = useState({ open: false, mode: 'create', data: null });
  const [form,        setForm]        = useState({ template_name: '', description: '' });
  const [selected,    setSelected]    = useState([]); // component IDs + overrides
  const [saving,      setSaving]      = useState(false);
  const [viewDialog,  setViewDialog]  = useState({ open: false, data: null });
  const [snack,       setSnack]       = useState({ open: false, msg: '', sev: 'success' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpl, comps] = await Promise.all([
        apiRequest('/payroll/templates'),
        apiRequest('/payroll/components'),
      ]);
      setTemplates(tmpl || []);
      setComponents(comps || []);
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openCreate = () => {
    setForm({ template_name: '', description: '' });
    setSelected([]);
    setDialog({ open: true, mode: 'create', data: null });
  };

  const openEdit = async (tmpl) => {
    setForm({ template_name: tmpl.template_name, description: tmpl.description || '' });
    setDialog({ open: true, mode: 'edit', data: tmpl });
    try {
      const detail = await apiRequest(`/payroll/templates/${tmpl.id}`);
      const sel = (detail.components || []).map((c, idx) => ({
        component_id: c.component_id,
        sort_order:   c.sort_order ?? idx,
        override_value:      c.override_value ?? null,
        override_percentage: c.override_percentage ?? null,
        override_formula:    c.override_formula ?? null,
      }));
      setSelected(sel);
    } catch {}
  };

  const openView = async (tmpl) => {
    try {
      const detail = await apiRequest(`/payroll/templates/${tmpl.id}`);
      setViewDialog({ open: true, data: detail });
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    }
  };

  const toggleComponent = (comp) => {
    const exists = selected.find(s => s.component_id === comp.id);
    if (exists) {
      setSelected(prev => prev.filter(s => s.component_id !== comp.id));
    } else {
      setSelected(prev => [...prev, { component_id: comp.id, sort_order: prev.length, override_value: null, override_percentage: null, override_formula: null }]);
    }
  };

  const isSelected = (compId) => selected.some(s => s.component_id === compId);

  const handleSave = async () => {
    if (!form.template_name) {
      setSnack({ open: true, msg: 'Template name is required', sev: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, components: selected };
      if (dialog.mode === 'create') {
        await apiRequest('/payroll/templates', { method: 'POST', body: payload });
        setSnack({ open: true, msg: 'Template created!', sev: 'success' });
      } else {
        await apiRequest(`/payroll/templates/${dialog.data.id}`, { method: 'PUT', body: payload });
        setSnack({ open: true, msg: 'Template updated!', sev: 'success' });
      }
      setDialog({ open: false });
      loadAll();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await apiRequest(`/payroll/templates/${id}`, { method: 'DELETE' });
      setSnack({ open: true, msg: 'Template deleted', sev: 'success' });
      loadAll();
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    }
  };

  const earnings   = components.filter(c => c.component_type === 'earning'   && c.is_active);
  const deductions = components.filter(c => c.component_type === 'deduction' && c.is_active);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
            Salary Structure Templates
          </Typography>
          <Typography color="text.secondary">
            Build reusable salary templates by combining earning and deduction components
          </Typography>
        </Box>
        <Button
          variant="contained" startIcon={<Add />} onClick={openCreate}
          sx={{ borderRadius: 2, px: 3, fontWeight: 700, flexShrink: 0 }}
        >
          New Template
        </Button>
      </Box>

      {loading ? (
        [1,2,3].map(i => <Skeleton key={i} height={96} sx={{ mb: 2, borderRadius: 3 }} />)
      ) : templates.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
          <AccountTree sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" fontWeight={600}>No salary templates yet</Typography>
          <Typography sx={{ mb: 3 }}>Create a template to assign to employees</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Create First Template</Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {templates.map(tmpl => (
            <Grid item xs={12} sm={6} md={4} key={tmpl.id}>
              <Card sx={{
                borderRadius: 3, height: '100%', border: '1px solid #E2E8F0',
                transition: 'all 0.2s',
                '&:hover': { boxShadow: '0 8px 30px rgba(0,0,0,0.1)', borderColor: '#6366F1' },
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography fontWeight={700} sx={{ mb: 0.5 }}>{tmpl.template_name}</Typography>
                      <Typography variant="body2" color="text.secondary">{tmpl.description || 'No description'}</Typography>
                    </Box>
                    <Chip
                      label={tmpl.is_active ? 'Active' : 'Inactive'}
                      color={tmpl.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Chip label={`${tmpl.component_count} components`} size="small" variant="outlined" />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => openView(tmpl)}>View</Button>
                    <Button size="small" onClick={() => openEdit(tmpl)} startIcon={<Edit sx={{ fontSize: 14 }} />}>Edit</Button>
                    <IconButton size="small" color="error" onClick={() => handleDelete(tmpl.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false })} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {dialog.mode === 'create' ? 'Create Salary Structure Template' : 'Edit Salary Structure Template'}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Template Name" size="small" value={form.template_name}
                onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))}
                placeholder="e.g. Software Engineer Package"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label="Description" size="small" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
              />
            </Grid>
          </Grid>

          <Typography fontWeight={700} sx={{ mb: 1.5 }}>Select Components</Typography>

          {/* Earnings */}
          <Accordion defaultExpanded sx={{ mb: 1, borderRadius: '12px !important', '&:before': { display: 'none' }, border: '1px solid #E2E8F0' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ fontWeight: 700, color: '#059669' }}>
              Earnings ({earnings.filter(c => isSelected(c.id)).length}/{earnings.length} selected)
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {earnings.map(comp => (
                  <ListItem key={comp.id} sx={{ borderRadius: 1, '&:hover': { bgcolor: '#F0FDF4' } }}>
                    <Checkbox
                      checked={isSelected(comp.id)}
                      onChange={() => toggleComponent(comp)}
                      size="small"
                      sx={{ color: '#059669', '&.Mui-checked': { color: '#059669' } }}
                    />
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600}>{comp.component_name}</Typography>}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <code style={{ fontSize: '0.7rem', background: '#F1F5F9', padding: '1px 4px', borderRadius: 3 }}>{comp.component_code}</code>
                          <Typography variant="caption" color="text.secondary">
                            {comp.calculation_type === 'fixed' && `₹${Number(comp.default_value || 0).toLocaleString('en-IN')}`}
                            {comp.calculation_type === 'percentage' && `${comp.percentage_value}% of ${comp.percentage_of}`}
                            {comp.calculation_type === 'formula' && comp.formula_expression}
                            {comp.calculation_type === 'dynamic' && 'Dynamic'}
                          </Typography>
                        </Box>
                      }
                    />
                    {isSelected(comp.id) && <CheckCircle sx={{ color: '#059669', fontSize: 18 }} />}
                  </ListItem>
                ))}
                {earnings.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No earning components. Add some first.</Typography>}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Deductions */}
          <Accordion defaultExpanded sx={{ borderRadius: '12px !important', '&:before': { display: 'none' }, border: '1px solid #E2E8F0' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ fontWeight: 700, color: '#DC2626' }}>
              Deductions ({deductions.filter(c => isSelected(c.id)).length}/{deductions.length} selected)
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {deductions.map(comp => (
                  <ListItem key={comp.id} sx={{ borderRadius: 1, '&:hover': { bgcolor: '#FEF2F2' } }}>
                    <Checkbox
                      checked={isSelected(comp.id)}
                      onChange={() => toggleComponent(comp)}
                      size="small"
                      sx={{ color: '#DC2626', '&.Mui-checked': { color: '#DC2626' } }}
                    />
                    <ListItemText
                      primary={<Typography variant="body2" fontWeight={600}>{comp.component_name}</Typography>}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <code style={{ fontSize: '0.7rem', background: '#F1F5F9', padding: '1px 4px', borderRadius: 3 }}>{comp.component_code}</code>
                          <Typography variant="caption" color="text.secondary">
                            {comp.calculation_type === 'fixed' && `₹${Number(comp.default_value || 0).toLocaleString('en-IN')}`}
                            {comp.calculation_type === 'percentage' && `${comp.percentage_value}% of ${comp.percentage_of}`}
                            {comp.calculation_type === 'formula' && comp.formula_expression}
                          </Typography>
                        </Box>
                      }
                    />
                    {isSelected(comp.id) && <RemoveCircle sx={{ color: '#DC2626', fontSize: 18 }} />}
                  </ListItem>
                ))}
                {deductions.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No deduction components. Add some first.</Typography>}
              </List>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 2, p: 2, bgcolor: '#F0F9FF', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>{selected.length} components</strong> selected.
              {selected.length > 0 && ' You can adjust override values after creating the template.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialog({ open: false })}>Cancel</Button>
          <Button
            variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          >
            {saving ? 'Saving…' : dialog.mode === 'create' ? 'Create Template' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog.open} onClose={() => setViewDialog({ open: false })} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{viewDialog.data?.template_name}</DialogTitle>
        <Divider />
        <DialogContent>
          {viewDialog.data?.components?.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                    <TableCell>Component</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Calculation</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewDialog.data.components.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell fontWeight={600}>{c.component_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={c.component_type}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            bgcolor: TYPE_COLORS[c.component_type]?.bg,
                            color:   TYPE_COLORS[c.component_type]?.color,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell variant="caption">
                        {c.calculation_type === 'fixed'      && `₹${Number(c.override_value ?? c.default_value ?? 0).toLocaleString('en-IN')}`}
                        {c.calculation_type === 'percentage' && `${c.override_percentage ?? c.percentage_value}% of ${c.percentage_of}`}
                        {c.calculation_type === 'formula'    && <code style={{ fontSize: '0.72rem' }}>{c.override_formula ?? c.formula_expression}</code>}
                        {c.calculation_type === 'dynamic'    && 'Dynamic (incentives)'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : <Typography color="text.secondary">No components in this template</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setViewDialog({ open: false })}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={5000} onClose={() => setSnack(p => ({ ...p, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
