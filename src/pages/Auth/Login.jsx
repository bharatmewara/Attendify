import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Snackbar,
  IconButton,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import ShieldMoonRoundedIcon from '@mui/icons-material/ShieldMoonRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import MarkEmailReadRoundedIcon from '@mui/icons-material/MarkEmailReadRounded';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getTenantBrandName } from '../../lib/tenantBranding';
import { apiRequest } from '../../lib/api';

const trustPoints = ['ISO 27001 Ready', 'SOC Controls', '99.99% Uptime SLA'];

// Screens: 'login' | 'forgot' | 'forgot_sent'
const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', companyCode: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const brandName = getTenantBrandName();

  const onInput = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/app/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: forgotEmail } });
      setScreen('forgot_sent');
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const heroTitle = brandName === 'Attendify'
    ? 'One platform for attendance, payroll, and HR operations.'
    : `${brandName} workforce workspace.`;
  const workspaceLabel = brandName === 'Attendify' ? 'company workspace' : `${brandName} workspace`;

  const HeroPanel = (
    <Grid size={{ xs: 12, md: 6 }}>
      <Paper
        sx={{
          height: '100%',
          p: { xs: 3, md: 5 },
          borderRadius: 4,
          background: 'linear-gradient(160deg, #0F172A 0%, #1D4ED8 52%, #38BDF8 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={2.5}>
          <Chip
            icon={<ShieldMoonRoundedIcon />}
            label={brandName === 'Attendify' ? 'Enterprise Grade HRMS' : `${brandName} Portal`}
            sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }}
          />
          <Typography variant="h3" fontWeight={800}>
            {heroTitle}
          </Typography>
          <Typography sx={{ opacity: 0.9 }}>
            Run attendance, leave approvals, shifts, payroll, employee records, and HR documents from a single secure workspace.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {trustPoints.map((point) => (
              <Chip
                key={point}
                icon={<SecurityRoundedIcon />}
                label={point}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            ))}
          </Stack>
          <Alert
            icon={<BoltRoundedIcon fontSize="inherit" />}
            severity="info"
            sx={{
              mt: 1,
              bgcolor: 'rgba(15, 23, 42, 0.45)',
              color: 'white',
              '& .MuiAlert-icon': { color: '#BAE6FD' },
            }}
          >
            Live sync enabled: biometric devices, mobile punch, and payroll engine are connected.
          </Alert>
        </Stack>
      </Paper>
    </Grid>
  );

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 72px)',
        py: { xs: 3, md: 6 },
        background: 'radial-gradient(circle at 10% 0%, #E0F2FE 0%, #F8FAFC 45%, #EFF6FF 100%)',
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4} alignItems="stretch">
          {HeroPanel}

          <Grid size={{ xs: 12, md: 6 }}>
            {/* ── LOGIN SCREEN ── */}
            {screen === 'login' && (
              <Paper component="form" onSubmit={onSubmit} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
                <Typography variant="h4" fontWeight={800} gutterBottom>
                  Welcome back
                </Typography>
                <Typography color="text.secondary" mb={3}>
                  Sign in to continue to your {workspaceLabel}.
                </Typography>

                <Stack spacing={2}>
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
                  <TextField fullWidth label="Work Email" type="email" value={form.email} onChange={onInput('email')} required />
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={form.password}
                    onChange={onInput('password')}
                    required
                  />
                  <TextField
                    fullWidth
                    label="Company Code"
                    helperText="Optional for now. Example: ATT-IND-01"
                    value={form.companyCode}
                    onChange={onInput('companyCode')}
                  />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <FormControlLabel control={<Checkbox />} label="Remember this device" />
                    <Button size="small" onClick={() => { setError(''); setForgotEmail(''); setScreen('forgot'); }}>
                      Forgot password?
                    </Button>
                  </Stack>
                  <Button type="submit" variant="contained" size="large" sx={{ py: 1.4 }} disabled={loading}>
                    Sign in to {brandName}
                  </Button>
                  <Divider>or</Divider>
                  <Button variant="outlined" size="large">
                    Continue with Microsoft SSO
                  </Button>
                  <Button variant="outlined" size="large">
                    Continue with Google Workspace
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    By signing in, you agree to data processing and security monitoring policies.
                  </Typography>
                </Stack>
              </Paper>
            )}

            {/* ── FORGOT PASSWORD SCREEN ── */}
            {screen === 'forgot' && (
              <Paper component="form" onSubmit={onForgotSubmit} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <IconButton size="small" onClick={() => { setError(''); setScreen('login'); }}>
                    <ArrowBackRoundedIcon />
                  </IconButton>
                  <Typography variant="h5" fontWeight={800}>Reset your password</Typography>
                </Stack>
                <Typography color="text.secondary" mb={3}>
                  Enter your work email and we'll send you a link to reset your password.
                </Typography>

                <Stack spacing={2}>
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
                  <TextField
                    fullWidth
                    label="Work Email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" variant="contained" size="large" sx={{ py: 1.4 }} disabled={loading}>
                    Send Reset Link
                  </Button>
                  <Button variant="text" onClick={() => { setError(''); setScreen('login'); }}>
                    Back to Sign In
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* ── FORGOT SENT SCREEN ── */}
            {screen === 'forgot_sent' && (
              <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, textAlign: 'center' }}>
                <Stack spacing={3} alignItems="center">
                  <Box sx={{ bgcolor: 'primary.light', borderRadius: '50%', p: 2, display: 'inline-flex' }}>
                    <MarkEmailReadRoundedIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                  </Box>
                  <Typography variant="h5" fontWeight={800}>Check your inbox</Typography>
                  <Typography color="text.secondary">
                    We've sent a password reset link to <strong>{forgotEmail}</strong>. Check your email and follow the instructions.
                  </Typography>
                  <Alert severity="info" sx={{ width: '100%', textAlign: 'left' }}>
                    Didn't receive the email? Check your spam folder or wait a few minutes before trying again.
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => { setForgotEmail(''); setScreen('forgot'); }}
                  >
                    Try a different email
                  </Button>
                  <Button variant="text" onClick={() => { setError(''); setForgotEmail(''); setScreen('login'); }}>
                    Back to Sign In
                  </Button>
                </Stack>
              </Paper>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default LoginPage;
