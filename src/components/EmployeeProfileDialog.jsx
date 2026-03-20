import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { apiRequest } from '../lib/api';
import { currency } from '../utils/fileExports';

const Stat = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700}>
      {value}
    </Typography>
  </Paper>
);

export default function EmployeeProfileDialog({ open, onClose, employeeId }) {
  const [tab, setTab] = useState(0);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !employeeId) return;

    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest(`/employees/${employeeId}/profile`);
        setProfile(data);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [open, employeeId]);

  const employee = profile?.employee;
  const attendance = profile?.attendance || {};
  const balances = profile?.leave?.balances || [];
  const requests = profile?.leave?.requests || [];
  const payrolls = profile?.payroll || [];
  const documents = profile?.documents || [];

  const tabs = useMemo(
    () => ['Overview', 'Attendance', 'Leave', 'Payroll', 'Documents'],
    [],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>
          {employee ? `${employee.first_name} ${employee.last_name}` : 'Employee Record'}
        </Typography>
        {employee ? (
          <Typography color="text.secondary">
            {employee.employee_code} | {employee.designation_title || 'No designation'} | {employee.department_name || 'No department'}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers>
        {loading ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        {profile ? (
          <Box>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
              {tabs.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>

            {tab === 0 ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}><Stat label="Email" value={employee.email || '-'} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Phone" value={employee.phone || '-'} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Employment Type" value={employee.employment_type || '-'} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Status" value={employee.status || '-'} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Current Shift" value={profile.shift?.name || '-'} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Salary" value={currency(profile.salary?.basic_salary)} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Present Days" value={attendance.summary?.present_count || 0} /></Grid>
                <Grid item xs={12} md={3}><Stat label="Pending Leaves" value={requests.filter((item) => item.status === 'pending').length} /></Grid>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                      Basic Information
                    </Typography>
                    <Typography color="text.secondary">
                      Joining Date: {employee.joining_date ? new Date(employee.joining_date).toLocaleDateString() : '-'}
                    </Typography>
                    <Typography color="text.secondary">Address: {employee.address || '-'}</Typography>
                    <Typography color="text.secondary">
                      Emergency Contact: {employee.emergency_contact_name || '-'} {employee.emergency_contact ? `(${employee.emergency_contact})` : ''}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            ) : null}

            {tab === 1 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Punch In</TableCell>
                      <TableCell>Punch Out</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Late</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(attendance.records || []).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.work_date).toLocaleDateString()}</TableCell>
                        <TableCell>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString() : '-'}</TableCell>
                        <TableCell>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString() : '-'}</TableCell>
                        <TableCell>{record.total_hours || '-'}</TableCell>
                        <TableCell>{record.late_minutes || 0}</TableCell>
                        <TableCell><Chip size="small" label={record.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}

            {tab === 2 ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={5}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Leave Balance</Typography>
                    {balances.map((balance) => (
                      <Box key={balance.id} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{balance.leave_type_name}</Typography>
                          <Typography variant="body2">{balance.remaining_days}/{balance.total_days}</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={balance.total_days ? (Number(balance.remaining_days) / Number(balance.total_days)) * 100 : 0}
                          sx={{ height: 8, borderRadius: 99 }}
                        />
                      </Box>
                    ))}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={7}>
                  <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Dates</TableCell>
                          <TableCell>Days</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {requests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.leave_type_name}</TableCell>
                            <TableCell>
                              {new Date(request.start_date).toLocaleDateString()} to {new Date(request.end_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{request.total_days}</TableCell>
                            <TableCell><Chip label={request.status} size="small" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
              </Grid>
            ) : null}

            {tab === 3 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell>Gross</TableCell>
                      <TableCell>Deductions</TableCell>
                      <TableCell>Net</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payrolls.map((payroll) => (
                      <TableRow key={payroll.id}>
                        <TableCell>{new Date(payroll.year, payroll.month - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>{currency(payroll.gross_salary)}</TableCell>
                        <TableCell>{currency(Number(payroll.total_deductions) + Number(payroll.late_penalties) + Number(payroll.early_leave_penalties))}</TableCell>
                        <TableCell>{currency(payroll.net_salary)}</TableCell>
                        <TableCell><Chip label={payroll.status} size="small" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}

            {tab === 4 ? (
              <Box>
                {(documents || []).map((document) => (
                  <Paper key={document.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 3 }}>
                    <Typography fontWeight={700}>{document.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {document.document_type} | {new Date(document.generated_at).toLocaleDateString()}
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {document.content}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
