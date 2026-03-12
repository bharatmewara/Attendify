import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  MenuItem,
  Paper,
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
import EmployeeProfileDialog from '../../components/EmployeeProfileDialog';
import { exportRowsToCsv } from '../../utils/fileExports';
import NetworkPolicyManager from '../app/NetworkPolicyManager';
import { useAuth } from '../../context/AuthContext';

export default function AttendanceManagement() {
  const { user } = useAuth();
  const canManageNetworkPolicies = user?.role === 'company_admin' || user?.role === 'super_admin';
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [profileEmployeeId, setProfileEmployeeId] = useState(null);
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

      {message.text ? (
        <Alert severity={message.type || 'info'} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      ) : null}

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
                      <Button size="small" startIcon={<Visibility />} onClick={() => setProfileEmployeeId(record.employee_id)}>
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

      <EmployeeProfileDialog open={Boolean(profileEmployeeId)} onClose={() => setProfileEmployeeId(null)} employeeId={profileEmployeeId} />
    </Box>
  );
}
