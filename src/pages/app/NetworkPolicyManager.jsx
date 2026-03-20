import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
  Snackbar,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

const NetworkPolicyManager = () => {
  const { token, user } = useAuth();
  const canManagePolicies = user?.role === 'company_admin' || user?.role === 'super_admin';
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState({
    label: '',
    networkCidr: '',
    employeeLoginAllowed: true,
    punchAllowed: true,
    isActive: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const data = await apiRequest('/network-policies', { token });
        setPolicies(data.policies);
      } catch (err) {
        setError(err.message || 'Failed to load policies');
      }
    };
    if (canManagePolicies) {
      loadPolicies();
    }
  }, [canManagePolicies, token]);

  if (!canManagePolicies) {
    return (
      <Alert severity="warning">Only company admins can manage office network IP policies.</Alert>
    );
  }

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const onCreate = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiRequest('/network-policies', { method: 'POST', token, body: form });
      setMessage('Network policy created.');
      setForm({
        label: '',
        networkCidr: '',
        employeeLoginAllowed: true,
        punchAllowed: true,
        isActive: true,
      });
      const data = await apiRequest('/network-policies', { token });
      setPolicies(data.policies);
    } catch (err) {
      setError(err.message || 'Failed to create policy');
    }
  };

  return (
    <Stack spacing={2}>
      <Snackbar 
        open={Boolean(message)} 
        autoHideDuration={6000} 
        onClose={() => setMessage('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message}
        </Alert>
      </Snackbar>

      <Snackbar 
        open={Boolean(error)} 
        autoHideDuration={6000} 
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity="error" variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {error}
        </Alert>
      </Snackbar>
      <Paper component="form" onSubmit={onCreate} sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={1.5}>
          Add Allowed Office Network
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Label"
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
              placeholder="Main Office WiFi"
              required
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="CIDR"
              value={form.networkCidr}
              onChange={(e) => setField('networkCidr', e.target.value)}
              placeholder="192.168.1.0/24"
              required
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1} height="100%" alignItems="center">
              <Button type="submit" variant="contained">
                Save Policy
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch checked={form.employeeLoginAllowed} onChange={(e) => setField('employeeLoginAllowed', e.target.checked)} />
                }
                label="Allow employee login from this network"
              />
              <FormControlLabel
                control={<Switch checked={form.punchAllowed} onChange={(e) => setField('punchAllowed', e.target.checked)} />}
                label="Allow punch-in from this network"
              />
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} />}
                label="Policy active"
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={1.5}>
          Active IP Policies
        </Typography>
        <Stack spacing={1}>
          {policies.length === 0 ? <Typography color="text.secondary">No network policies configured.</Typography> : null}
          {policies.map((policy) => (
            <Paper key={policy.id} variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2">
                {policy.label} | {policy.network_cidr} | Login: {policy.employee_login_allowed ? 'Yes' : 'No'} | Punch:{' '}
                {policy.punch_allowed ? 'Yes' : 'No'} | Active: {policy.is_active ? 'Yes' : 'No'}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
};

export default NetworkPolicyManager;
