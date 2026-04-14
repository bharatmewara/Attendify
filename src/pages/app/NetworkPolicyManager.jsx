import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, IconButton, Paper, Stack, Switch, TextField, Tooltip,
  Typography, Snackbar,
} from '@mui/material';
import { Delete, MyLocation, Wifi, WifiOff } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

const isPrivateIp = (cidr) => {
  const ip = cidr?.split('/')[0] || '';
  return ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
};

const normalizeCidr = (value) => {
  try {
    const trimmed = value.trim();
    if (!trimmed.includes('/')) return `${trimmed}/32`;
    const [ip, prefix] = trimmed.split('/');
    const bits = parseInt(prefix, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return trimmed;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return trimmed;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    const ipInt = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const networkInt = (ipInt & mask) >>> 0;
    return `${(networkInt >>> 24) & 0xff}.${(networkInt >>> 16) & 0xff}.${(networkInt >>> 8) & 0xff}.${networkInt & 0xff}/${bits}`;
  } catch {
    return value;
  }
};

const emptyForm = {
  label: '',
  networkCidr: '',
  employeeLoginAllowed: true,
  punchAllowed: true,
  isActive: true,
};

const NetworkPolicyManager = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'company_admin' || user?.role === 'super_admin';
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [detectedIp, setDetectedIp] = useState('');
  const [loadingIp, setLoadingIp] = useState(false);
  const [currentIp, setCurrentIp] = useState('');

  // Auto-detect current IP on load
  useEffect(() => {
    fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.ip) setCurrentIp(d.ip); })
      .catch(() => {});
  }, []);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const notify = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  const loadPolicies = async () => {
    try {
      const data = await apiRequest('/network-policies');
      setPolicies(data.policies || []);
    } catch (err) {
      notify(err.message || 'Failed to load policies', 'error');
    }
  };

  useEffect(() => {
    if (canManage) loadPolicies();
  }, [canManage]);

  if (!canManage) {
    return <Alert severity="warning">Only company admins can manage office network IP policies.</Alert>;
  }

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleUseCurrentWifi = async () => {
    setLoadingIp(true);
    try {
      // Same service used by api.js on load — guaranteed to match what backend sees
      const res = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const data = await res.json();
      const ip = data.ip;
      if (!ip) throw new Error('No IP returned');
      setDetectedIp(ip);
      setField('networkCidr', `${ip}/32`);
      notify(`Your current public IP: ${ip}`, 'info');
    } catch (err) {
      notify('Could not detect IP. Enter manually. Error: ' + err.message, 'error');
    } finally {
      setLoadingIp(false);
    }
  };

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, networkCidr: normalizeCidr(form.networkCidr) };
      await apiRequest('/network-policies', { method: 'POST', body: payload });
      notify('Network policy saved.');
      setForm(emptyForm);
      setDetectedIp('');
      loadPolicies();
    } catch (err) {
      notify(err.message || 'Failed to save policy', 'error');
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/network-policies/${deleteTarget.id}`, { method: 'DELETE' });
      notify(`Policy "${deleteTarget.label}" deleted.`);
      setDeleteTarget(null);
      loadPolicies();
    } catch (err) {
      notify(err.message || 'Failed to delete policy', 'error');
    }
  };

  const onToggleActive = async (policy) => {
    try {
      await apiRequest(`/network-policies/${policy.id}`, {
        method: 'PATCH',
        body: { isActive: !policy.is_active },
      });
      loadPolicies();
    } catch (err) {
      notify(err.message || 'Failed to update policy', 'error');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Snackbar
        open={snack.open} autoHideDuration={5000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>

      <Stack spacing={3}>
        {/* Add Policy Form */}
        <Paper component="form" onSubmit={onCreate} sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>Add Office Network Policy</Typography>
              <Typography variant="body2" color="text.secondary">
                Employees can only login &amp; punch from networks listed here (when at least one policy is active).
              </Typography>
            </Box>
            <Tooltip title="Auto-detect your current WiFi IP">
              <Button
                variant="outlined"
                startIcon={<MyLocation />}
                onClick={handleUseCurrentWifi}
                disabled={loadingIp}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {loadingIp ? 'Detecting...' : 'Use Current WiFi'}
              </Button>
            </Tooltip>
          </Stack>

          {currentIp && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button size="small" color="inherit" onClick={handleUseCurrentWifi}>
                  Use This IP
                </Button>
              }
            >
              Your current public IP is <strong>{currentIp}</strong>.
              {policies.some((p) => p.network_cidr === `${currentIp}/32` || p.network_cidr === currentIp)
                ? ' ✅ Already saved as a policy.'
                : ' ⚠ Not saved yet — click "Use This IP" to add it.'}
            </Alert>
          )}

          {detectedIp && (
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ Your current public IP is <strong>{detectedIp}</strong> — this is what the server sees.
              Save this policy, then <strong>delete any old private IP policies</strong> (192.168.x.x) for this to work correctly.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth required label="Policy Label"
                value={form.label}
                onChange={(e) => setField('label', e.target.value)}
                placeholder="Office WiFi"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth required label="Network CIDR"
                value={form.networkCidr}
                onChange={(e) => setField('networkCidr', e.target.value)}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val) setField('networkCidr', normalizeCidr(val));
                }}
                placeholder="192.168.1.0/24"
                helperText="Single IP: x.x.x.x/32  |  Subnet: x.x.x.0/24"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={<Switch checked={form.employeeLoginAllowed} onChange={(e) => setField('employeeLoginAllowed', e.target.checked)} />}
                  label="Allow Login"
                />
                <FormControlLabel
                  control={<Switch checked={form.punchAllowed} onChange={(e) => setField('punchAllowed', e.target.checked)} />}
                  label="Allow Punch"
                />
                <FormControlLabel
                  control={<Switch checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />}
                  label="Active"
                />
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained" size="large">Save Policy</Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Policies List */}
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} mb={2}>
            Configured Policies
            <Chip label={policies.length} size="small" sx={{ ml: 1 }} />
          </Typography>

          {currentIp && policies.length > 0 && !policies.some((p) => p.is_active && (p.network_cidr === `${currentIp}/32` || p.network_cidr === currentIp)) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Your current IP <strong>{currentIp}</strong> does not match any active policy.
              Employees on this network will be <strong>blocked</strong>. Click "Use This IP" above to add it.
            </Alert>
          )}

          {policies.length === 0 ? (
            <Alert severity="warning">
              No policies configured — all employees can login from any network.
            </Alert>
          ) : (
            <Stack spacing={1.5}>
              {policies.map((policy) => (
                <Paper
                  key={policy.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderColor: policy.is_active ? 'success.main' : 'grey.300',
                    bgcolor: policy.is_active ? 'success.50' : 'grey.50',
                    opacity: policy.is_active ? 1 : 0.7,
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      {policy.is_active ? <Wifi color="success" /> : <WifiOff color="disabled" />}
                      <Box>
                        <Typography fontWeight={700}>{policy.label}</Typography>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" color="text.secondary" fontFamily="monospace">
                            {policy.network_cidr}
                          </Typography>
                          {isPrivateIp(policy.network_cidr) && (
                            <Chip size="small" label="⚠ Private IP — won't work" color="warning" />
                          )}
                        </Stack>
                      </Box>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={`Login: ${policy.employee_login_allowed ? 'Yes' : 'No'}`}
                        color={policy.employee_login_allowed ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Punch: ${policy.punch_allowed ? 'Yes' : 'No'}`}
                        color={policy.punch_allowed ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={policy.is_active ? 'Active' : 'Inactive'}
                        color={policy.is_active ? 'success' : 'default'}
                        onClick={() => onToggleActive(policy)}
                        sx={{ cursor: 'pointer' }}
                      />
                      <Tooltip title="Delete policy">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(policy)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>

      {/* Delete Confirm Dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Policy</DialogTitle>
        <DialogContent>
          <Typography>
            Delete policy <strong>"{deleteTarget?.label}"</strong> ({deleteTarget?.network_cidr})?
            Employees on this network will be blocked if other policies exist.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={onDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NetworkPolicyManager;
