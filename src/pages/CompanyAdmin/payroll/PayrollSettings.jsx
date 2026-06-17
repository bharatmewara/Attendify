import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField,
  MenuItem, FormControlLabel, Switch, Alert, Snackbar, Divider,
  InputAdornment, CircularProgress, Skeleton,
} from '@mui/material';
import { Save, Settings, Info } from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const SALARY_CYCLES = [
  { value: 'monthly',   label: 'Monthly (most common)' },
  { value: 'biweekly',  label: 'Bi-weekly (every 2 weeks)' },
  { value: 'weekly',    label: 'Weekly' },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function PayrollSettings() {
  const [settings, setSettings] = useState({
    salary_cycle: 'monthly',
    payroll_start_day: 1,
    payroll_end_day: 31,
    salary_payout_day: 5,
    working_days_rule: 26,
    overtime_rate: 1.5,
    late_penalty_enabled: true,
  });
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [snack,   setSnack]     = useState({ open: false, msg: '', sev: 'success' });

  useEffect(() => {
    apiRequest('/payroll/settings')
      .then(data => setSettings(prev => ({ ...prev, ...data })))
      .catch(e => setSnack({ open: true, msg: e.message, sev: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await apiRequest('/payroll/settings', { method: 'PUT', body: settings });
      setSettings(prev => ({ ...prev, ...data }));
      setSnack({ open: true, msg: 'Payroll settings saved successfully!', sev: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: e.message, sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children, hint }) => (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{label}</Typography>
      {children}
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        {[1,2,3,4].map(i => <Skeleton key={i} height={60} sx={{ mb: 2 }} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A', mb: 0.5 }}>
          Payroll Settings
        </Typography>
        <Typography color="text.secondary">
          Configure salary cycle, payout dates, and working day rules for your company
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Salary Cycle */}
        <Grid item xs={12} md={8}>
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Settings sx={{ color: '#6366F1' }} />
                <Typography variant="h6" fontWeight={700}>Salary Cycle</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Field label="Salary Cycle Type" hint="How often employees are paid">
                    <TextField
                      select fullWidth size="small" value={settings.salary_cycle}
                      onChange={e => handleChange('salary_cycle', e.target.value)}
                    >
                      {SALARY_CYCLES.map(o => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </TextField>
                  </Field>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Field label="Payroll Period Start Day" hint="Day of month period starts">
                    <TextField
                      select fullWidth size="small" value={settings.payroll_start_day}
                      onChange={e => handleChange('payroll_start_day', Number(e.target.value))}
                    >
                      {DAY_OPTIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </TextField>
                  </Field>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Field label="Payroll Period End Day" hint="Day of month period ends">
                    <TextField
                      select fullWidth size="small" value={settings.payroll_end_day}
                      onChange={e => handleChange('payroll_end_day', Number(e.target.value))}
                    >
                      {DAY_OPTIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </TextField>
                  </Field>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Field label="Salary Payout Day" hint="Day salaries are disbursed">
                    <TextField
                      select fullWidth size="small" value={settings.salary_payout_day}
                      onChange={e => handleChange('salary_payout_day', Number(e.target.value))}
                    >
                      {DAY_OPTIONS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </TextField>
                  </Field>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Calculation Rules */}
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Info sx={{ color: '#0D9488' }} />
                <Typography variant="h6" fontWeight={700}>Calculation Rules</Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Field label="Working Days Per Month" hint="Used to calculate per-day salary rate">
                    <TextField
                      fullWidth size="small" type="number"
                      value={settings.working_days_rule}
                      onChange={e => handleChange('working_days_rule', Number(e.target.value))}
                      InputProps={{ inputProps: { min: 20, max: 31 } }}
                    />
                  </Field>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Field label="Overtime Rate Multiplier" hint="e.g. 1.5 = 1.5× daily rate per hour">
                    <TextField
                      fullWidth size="small" type="number"
                      value={settings.overtime_rate}
                      onChange={e => handleChange('overtime_rate', Number(e.target.value))}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">×</InputAdornment>,
                        inputProps: { min: 1, max: 3, step: 0.5 },
                      }}
                    />
                  </Field>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.late_penalty_enabled}
                        onChange={e => handleChange('late_penalty_enabled', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight={600}>Enable Late Penalty Deductions</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Deduct based on late_penalty_per_minute from shift configuration
                        </Typography>
                      </Box>
                    }
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained" size="large"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
              onClick={handleSave} disabled={saving}
              sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </Box>
        </Grid>

        {/* Info Panel */}
        <Grid item xs={12} md={4}>
          <Card sx={{ borderRadius: 3, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: '#065F46' }}>
                How Proration Works
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Daily Rate</strong> = Gross Salary ÷ Working Days
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Earned Amount</strong> = Daily Rate × (Present Days + Paid Leave Days)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Leave Deduction</strong> = Daily Rate × Unpaid Leave Days
              </Typography>
              <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                Changes apply to new payroll cycles only. Approved payroll is always frozen.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snack.open} autoHideDuration={5000}
        onClose={() => setSnack(p => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.sev} variant="filled" sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
