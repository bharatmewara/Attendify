import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Stack, Alert, Divider, Paper, Snackbar,
} from '@mui/material';
import { SaveRounded } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

export default function AdminSettings() {
  const [profile, setProfile] = useState({ username: '', email: '', product_name: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => {
    apiRequest('/superadmin/settings')
      .then((data) => setProfile({ username: data.username || '', email: data.email || '', product_name: data.product_name || '' }))
      .catch(() => {});
  }, []);

  const notify = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  const saveProfile = async () => {
    setLoading(true);
    try {
      await apiRequest('/superadmin/settings', { method: 'PUT', body: profile });
      notify('Settings saved successfully');
    } catch (err) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      notify('New passwords do not match', 'error');
      return;
    }
    if (passwords.new_password.length < 6) {
      notify('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: { current_password: passwords.current_password, new_password: passwords.new_password },
      });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
      notify('Password changed successfully');
    } catch (err) {
      notify(err.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 680 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Admin Settings</Typography>

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Profile & Branding</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Update super admin credentials and product name shown across the platform.
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth label="Username" value={profile.username}
              onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            />
            <TextField
              fullWidth label="Email" type="email" value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
            <TextField
              fullWidth label="Product Name" value={profile.product_name}
              helperText="This name appears in the sidebar and login page."
              onChange={(e) => setProfile({ ...profile, product_name: e.target.value })}
            />
            <Button
              variant="contained" startIcon={<SaveRounded />}
              onClick={saveProfile} disabled={loading} sx={{ alignSelf: 'flex-start' }}
            >
              Save Changes
            </Button>
          </Stack>
        </Paper>

        <Divider />

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Change Password</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Update your super admin account password.
          </Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth label="Current Password" type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
            />
            <TextField
              fullWidth label="New Password" type="password"
              value={passwords.new_password}
              onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
            />
            <TextField
              fullWidth label="Confirm New Password" type="password"
              value={passwords.confirm_password}
              onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
            />
            <Button
              variant="contained" color="warning" startIcon={<SaveRounded />}
              onClick={savePassword} disabled={loading} sx={{ alignSelf: 'flex-start' }}
            >
              Update Password
            </Button>
          </Stack>
        </Paper>
      </Stack>

      <Snackbar
        open={snack.open} autoHideDuration={5000} onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
