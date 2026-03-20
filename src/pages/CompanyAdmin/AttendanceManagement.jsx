import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download, Visibility } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { exportRowsToCsv } from '../../utils/fileExports';
import NetworkPolicyManager from '../app/NetworkPolicyManager';
import { useAuth } from '../../context/AuthContext';

export default function AttendanceManagement() {
  const { user } = useAuth();
  const canManageNetworkPolicies = user?.role === 'company_admin' || user?.role === 'super_admin';
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordStep, setRecordStep] = useState(0);
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    employee_id: '',
    status: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.status) params.append('status', filters.status);

      const [recordsData, summaryData, employeesData] = await Promise.all([
        apiRequest(`/attendance/records?${params.toString()}`),
        apiRequest('/attendance/summary'),
        apiRequest('/employees'),
      ]);
      setRecords(recordsData);
      setSummary(summaryData);
      setEmployees(employeesData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.start_date, filters.end_date, filters.employee_id, filters.status]);

  const summaryCards = useMemo(
    () => [
      { label: 'Present', value: summary?.present_count || 0 },
      { label: 'Absent', value: summary?.absent_count || 0 },
      { label: 'On Leave', value: summary?.leave_count || 0 },
      { label: 'Late Minutes', value: summary?.total_late_minutes || 0 },
    ],
    [summary],
  );

  const recordSteps = ['Attendance Snapshot', 'Punch Timeline', 'Work Summary'];

  const closeRecordDialog = () => {
    setSelectedRecord(null);
    setRecordStep(0);
  };

  const getStepContent = (step, record) => {
    if (!record) return null;
    if (step === 0) {
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Employee</Typography>
          <Typography>{record.first_name} {record.last_name} ({record.employee_code || record.employee_id})</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Date</Typography>
          <Typography>{new Date(record.work_date).toLocaleDateString()}</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Status</Typography>
          <Chip label={record.status} size="small" color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'default'} />
        </Box>
      );
    }
    if (step === 1) {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2">Punch In</Typography>
              <Typography>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString() : '-'}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2">Punch Out</Typography>
              <Typography>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString() : '-'}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2">Total Hours</Typography>
              <Typography>{record.total_hours || '-'}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2">Late Minutes</Typography>
              <Typography>{record.late_minutes || 0}</Typography>
            </Paper>
          </Grid>
        </Grid>
      );
    }
    return (
      <Box>
        <Typography variant="subtitle2">Compliance</Typography>
        <Typography>Allowed Working Hours: {record.total_hours ? `${record.total_hours} hrs` : 'N/A'}</Typography>
        <Typography sx={{ mt: 1 }}>Punch Status: {record.punch_in_time && record.punch_out_time ? 'Complete' : 'Incomplete'}</Typography>
        <Typography sx={{ mt: 1 }}>Workday Ratio: {record.total_hours ? `${Math.min((record.total_hours / 9) * 100, 100).toFixed(0)}%` : '0%'}</Typography>
      </Box>
    );
  };

  const handleNext = () => setRecordStep((prev) => Math.min(prev + 1, recordSteps.length - 1));
  const handleBack = () => setRecordStep((prev) => Math.max(prev - 1, 0));

  const handleExport = () => {
    exportRowsToCsv(
      records,
      [
        { label: 'Employee Code', value: 'employee_code' },
        { label: 'Employee Name', value: (row) => `${row.first_name} ${row.last_name}` },
        { label: 'Date', value: (row) => new Date(row.work_date).toLocaleDateString('en-IN') },
        { label: 'Punch In', value: (row) => (row.punch_in_time ? new Date(row.punch_in_time).toLocaleTimeString('en-IN') : '-') },
        { label: 'Punch Out', value: (row) => (row.punch_out_time ? new Date(row.punch_out_time).toLocaleTimeString('en-IN') : '-') },
        { label: 'Hours', value: 'total_hours' },
        { label: 'Late Minutes', value: 'late_minutes' },
        { label: 'Status', value: 'status' },
      ],
      `attendance-report-${filters.start_date}-${filters.end_date}.csv`,
    );
    setMessage({ type: 'success', text: 'Attendance report exported successfully.' });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Attendance Management</Typography>
          <Typography color="text.secondary">Professional reporting panel for attendance oversight and employee drill-down.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Download />} onClick={handleExport}>
          Export Report
        </Button>
      </Box>

      <Snackbar 
        open={Boolean(message.text)} 
        autoHideDuration={6000} 
        onClose={() => setMessage({ type: '', text: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity={message.type || 'info'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message.text}
        </Alert>
      </Snackbar>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography color="text.secondary">{card.label}</Typography>
                <Typography variant="h4" fontWeight={800}>{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {canManageNetworkPolicies ? (
        <Card sx={{ mb: 3, borderRadius: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
              Office Wi-Fi Punch Security
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Employees can punch in only from office Wi-Fi networks configured here. Leave login access enabled only for trusted office networks.
            </Typography>
            <NetworkPolicyManager />
          </CardContent>
        </Card>
      ) : null}

      <Card sx={{ mb: 3, borderRadius: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }} value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="End Date" type="date" InputLabelProps={{ shrink: true }} value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth select label="Employee" value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth select label="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="present">Present</MenuItem>
                <MenuItem value="absent">Absent</MenuItem>
                <MenuItem value="on_leave">On Leave</MenuItem>
                <MenuItem value="half_day">Half Day</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Attendance Records
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Punch In</TableCell>
                  <TableCell>Punch Out</TableCell>
                  <TableCell>Hours</TableCell>
                  <TableCell>Late (min)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>View</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>{record.first_name} {record.last_name}</TableCell>
                    <TableCell>{new Date(record.work_date).toLocaleDateString()}</TableCell>
                    <TableCell>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString() : '-'}</TableCell>
                    <TableCell>{record.total_hours || '-'}</TableCell>
                    <TableCell>{record.late_minutes || 0}</TableCell>
                    <TableCell>
                      <Chip label={record.status} size="small" color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Visibility />} onClick={() => { setSelectedRecord(record); setRecordStep(0); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRecord)} onClose={closeRecordDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Attendance Record Details
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={recordStep} alternativeLabel sx={{ mb: 2 }}>
            {recordSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {getStepContent(recordStep, selectedRecord)}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeRecordDialog}>Close</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={handleBack} disabled={recordStep === 0}>Back</Button>
          <Button onClick={handleNext} disabled={recordStep === recordSteps.length - 1}>Next</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
