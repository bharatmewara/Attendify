import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  Snackbar,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

const todayRange = () => {
  const d = new Date().toISOString().slice(0, 10);
  return { start: d, end: d };
};

const AttendanceWorkspace = () => {
  const { token, user } = useAuth();
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [today, setToday] = useState(null);
  const [report, setReport] = useState([]);
  const [biometric, setBiometric] = useState({ employeeId: '', punchedAt: '' });
  const [loading, setLoading] = useState(false);

  const features = useMemo(
    () => ['Online Punch System', 'Biometric Machine Integration', 'Present / Absent Tracking', 'Late Minutes Calculation'],
    [],
  );

  const loadToday = async () => {
    const data = await apiRequest('/attendance/today-status', { token });
    setToday(data.attendance || data.summary || null);
  };

  const loadReport = async () => {
    const { start, end } = todayRange();
    const data = await apiRequest(`/attendance/report?start=${start}&end=${end}`, { token });
    setReport(data.records);
  };

  const runAction = async (fn) => {
    setFeedback({ type: '', message: '' });
    setLoading(true);
    try {
      await fn();
      await loadToday();
      await loadReport();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Action failed' });
    } finally {
      setLoading(false);
    }
  };

  const handlePunch = async () => {
    await runAction(async () => {
      await apiRequest('/attendance/punch-in', { method: 'POST', token });
      setFeedback({ type: 'success', message: 'Punch-in recorded successfully.' });
    });
  };

  const handleBiometricSync = async () => {
    await runAction(async () => {
      await apiRequest('/attendance/biometric-sync', {
        method: 'POST',
        token,
        body: { employeeId: Number(biometric.employeeId), punchedAt: biometric.punchedAt },
      });
      setFeedback({ type: 'success', message: 'Biometric record synced.' });
    });
  };

  const handleMarkAbsent = async () => {
    await runAction(async () => {
      const data = await apiRequest('/attendance/mark-absent-today', { method: 'POST', token });
      setFeedback({ type: 'success', message: `${data.created} employees marked absent.` });
    });
  };

  const boot = async () => {
    await runAction(async () => undefined);
  };

  return (
    <Box sx={{ py: 3.5 }}>
      <Container maxWidth="xl">
        <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
          <Typography variant="h5" fontWeight={800}>
            Attendance Management Workspace
          </Typography>
          <Typography color="text.secondary" mt={1} mb={2}>
            Punch requires office approved network. Attendance view and reports work from anywhere after login.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {features.map((feature) => (
              <Chip key={feature} label={feature} />
            ))}
          </Stack>
        </Paper>

        <Snackbar 
          open={Boolean(feedback.message)} 
          autoHideDuration={6000} 
          onClose={() => setFeedback({ ...feedback, message: '' })}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ zIndex: 9999 }}
        >
          <Alert severity={feedback.type || 'info'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
            {feedback.message}
          </Alert>
        </Snackbar>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
              <Typography variant="h6" fontWeight={700} mb={1}>
                Online Punch System
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Employee punch-in uses IP whitelist policy from admin network settings.
              </Typography>
              <Button variant="contained" onClick={handlePunch} disabled={loading || user?.role !== 'employee'}>
                Punch In (Office IP Required)
              </Button>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
              <Typography variant="h6" fontWeight={700} mb={1}>
                Present / Absent and Late Minutes
              </Typography>
              <Stack spacing={1.2} mb={2}>
                <Typography variant="body2">Today Status: {today?.status || 'N/A'}</Typography>
                <Typography variant="body2">Late Minutes: {today?.late_minutes ?? today?.total_late_minutes ?? 0}</Typography>
              </Stack>
              <Button variant="outlined" onClick={boot} disabled={loading}>
                Refresh Today Status
              </Button>
            </Paper>
          </Grid>

          {user?.role === 'company_admin' ? (
            <Grid size={{ xs: 12 }}>
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700} mb={1}>
                  Biometric Machine Integration (Admin)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Employee ID"
                      value={biometric.employeeId}
                      onChange={(e) => setBiometric((prev) => ({ ...prev, employeeId: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      type="datetime-local"
                      label="Punched At"
                      InputLabelProps={{ shrink: true }}
                      value={biometric.punchedAt}
                      onChange={(e) => setBiometric((prev) => ({ ...prev, punchedAt: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" onClick={handleBiometricSync} disabled={loading}>
                        Sync Biometric
                      </Button>
                      <Button variant="outlined" onClick={handleMarkAbsent} disabled={loading}>
                        Mark Absent Today
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          ) : null}

          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={700} mb={1}>
                Attendance Report (Today)
              </Typography>
              <Stack spacing={1}>
                {report.length === 0 ? <Typography color="text.secondary">No records yet.</Typography> : null}
                {report.map((row) => (
                  <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2">
                      {row.full_name} | {row.work_date} | {row.status} | Late: {row.late_minutes} min | Source: {row.source}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AttendanceWorkspace;
