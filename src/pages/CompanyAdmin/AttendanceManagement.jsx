import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Download,
  ExpandMore,
  Search,
  Visibility,
  Today,
  DateRange,
  CheckCircle,
  Cancel,
  AccessTime,
  Schedule,
  EventBusy,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { exportRowsToCsv } from '../../utils/fileExports';
import NetworkPolicyManager from '../app/NetworkPolicyManager';
import { useAuth } from '../../context/AuthContext';

export default function AttendanceManagement() {
  const { user } = useAuth();
  const canManageNetworkPolicies = user?.role === 'company_admin' || user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState(0); // 0 = Day-wise Grouped, 1 = Flat Records
  const [groupedDays, setGroupedDays] = useState([]);
  const [groupedLoading, setGroupedLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordStep, setRecordStep] = useState(0);

  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    employee_id: '',
    status: '',
    search: '',
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      setGroupedLoading(true);
      setRecordsLoading(true);

      const [groupedData, recordsData, summaryData, employeesData] = await Promise.all([
        apiRequest(`/attendance/daily-grouped?${params.toString()}`).catch(() => ({ dates: [] })),
        apiRequest(`/attendance/records?${params.toString()}`).catch(() => []),
        apiRequest(`/attendance/summary?${params.toString()}`).catch(() => null),
        apiRequest('/employees').catch(() => []),
      ]);

      setGroupedDays(groupedData?.dates || []);
      setRecords(recordsData || []);
      setSummary(summaryData);
      setEmployees(employeesData || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setGroupedLoading(false);
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.start_date, filters.end_date, filters.employee_id, filters.status]);

  const applyQuickRange = (range) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    let start = '', end = fmt(today);

    if (range === 'today') {
      start = fmt(today);
    } else if (range === 'week') {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      start = fmt(d);
    } else if (range === 'month') {
      start = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
    } else if (range === 'last_month') {
      start = fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      end = fmt(new Date(today.getFullYear(), today.getMonth(), 0));
    }

    setFilters((prev) => ({ ...prev, start_date: start, end_date: end }));
  };

  const summaryCards = useMemo(
    () => [
      { label: 'Present', value: summary?.present_count || 0, color: '#15803D' },
      { label: 'Absent', value: summary?.absent_count || 0, color: '#DC2626' },
      { label: 'On Leave', value: summary?.leave_count || 0, color: '#D97706' },
      { label: 'Late Count', value: summary?.late_count || 0, color: '#EA580C' },
      { label: 'Attendance Rate', value: `${summary?.attendance_percentage ?? 0}%`, color: '#2563EB' },
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
          <Typography fontWeight={600}>
            {record.first_name} {record.last_name} ({record.employee_code || record.employee_id})
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Date</Typography>
          <Typography>{new Date(record.work_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Status</Typography>
          <Chip
            label={String(record.status).toUpperCase()}
            size="small"
            color={
              record.status === 'present' ? 'success' :
              record.status === 'absent' ? 'error' :
              record.status === 'half_day' ? 'info' :
              record.status === 'on_leave' ? 'warning' : 'default'
            }
          />
        </Box>
      );
    }
    if (step === 1) {
      return (
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Punch In</Typography>
              <Typography fontWeight={600}>
                {record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString('en-IN') : '—'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Punch Out</Typography>
              <Typography fontWeight={600}>
                {record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString('en-IN') : '—'}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Total Hours</Typography>
              <Typography fontWeight={600}>{record.total_hours ? `${record.total_hours} hrs` : '—'}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Late Minutes</Typography>
              <Typography fontWeight={600} color={Number(record.late_minutes) > 0 ? 'error.main' : 'text.primary'}>
                {record.late_minutes || 0} min
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      );
    }
    return (
      <Box>
        <Typography variant="subtitle2">Compliance & Work Ratio</Typography>
        <Typography sx={{ mt: 1 }}>Logged Hours: {record.total_hours ? `${record.total_hours} hrs` : '—'}</Typography>
        <Typography sx={{ mt: 1 }}>
          Punch Status: {record.punch_in_time && record.punch_out_time ? 'Complete' : record.punch_in_time ? 'Punched In (Active)' : 'Missing Punch'}
        </Typography>
        <Typography sx={{ mt: 1 }}>
          Workday Ratio (9 hrs base): {record.total_hours ? `${Math.min((record.total_hours / 9) * 100, 100).toFixed(0)}%` : '0%'}
        </Typography>
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
        { label: 'Employee Name', value: (row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() },
        { label: 'Date', value: (row) => new Date(row.work_date).toLocaleDateString('en-IN') },
        { label: 'Punch In', value: (row) => (row.punch_in_time ? new Date(row.punch_in_time).toLocaleTimeString('en-IN') : '—') },
        { label: 'Punch Out', value: (row) => (row.punch_out_time ? new Date(row.punch_out_time).toLocaleTimeString('en-IN') : '—') },
        { label: 'Hours', value: 'total_hours' },
        { label: 'Late Minutes', value: 'late_minutes' },
        { label: 'Status', value: 'status' },
      ],
      `attendance-report-${filters.start_date || 'all'}-${filters.end_date || 'all'}.csv`,
    );
    setMessage({ type: 'success', text: 'Attendance report exported successfully.' });
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Attendance Management</Typography>
          <Typography color="text.secondary">
            Daily reconciled attendance tracking with date-wise grouping and employee lifecycle audit.
          </Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<Download />} onClick={handleExport} sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
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

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={6} sm={4} md={2.4} key={card.label}>
            <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {card.label}
                </Typography>
                <Typography variant="h5" fontWeight={800} sx={{ color: card.color, mt: 0.5 }}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Office Wi-Fi Punch Security (if allowed) */}
      {canManageNetworkPolicies && (
        <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #E2E8F0' }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              Office Wi-Fi Punch Security
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Employees can punch in only from office Wi-Fi networks configured here.
            </Typography>
            <NetworkPolicyManager />
          </CardContent>
        </Card>
      )}

      {/* Filters Bar */}
      <Card sx={{ mb: 3, borderRadius: 3, border: '1px solid #E2E8F0' }}>
        <CardContent sx={{ p: 2.5 }}>
          {/* Quick Date Presets */}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip label="Today" size="small" variant="outlined" onClick={() => applyQuickRange('today')} sx={{ cursor: 'pointer' }} />
            <Chip label="This Week" size="small" variant="outlined" onClick={() => applyQuickRange('week')} sx={{ cursor: 'pointer' }} />
            <Chip label="This Month" size="small" variant="outlined" onClick={() => applyQuickRange('month')} sx={{ cursor: 'pointer' }} />
            <Chip label="Last Month" size="small" variant="outlined" onClick={() => applyQuickRange('last_month')} sx={{ cursor: 'pointer' }} />
          </Stack>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label="Start Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label="End Date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                select
                label="Employee"
                value={filters.employee_id}
                onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              >
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code || `EMP-${employee.id}`})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                select
                label="Status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="present">Present</MenuItem>
                <MenuItem value="absent">Absent</MenuItem>
                <MenuItem value="on_leave">On Leave</MenuItem>
                <MenuItem value="half_day">Half Day</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Name or Code"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={loadData}>
                        <Search fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* View Switcher Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_e, val) => setActiveTab(val)}>
          <Tab label={`Date-wise Grouping (${groupedDays.length} days)`} />
          <Tab label={`All Flat Records (${records.length} entries)`} />
        </Tabs>
      </Box>

      {/* TAB 0: DAY-WISE GROUPED VIEW */}
      {activeTab === 0 && (
        <Box>
          {groupedLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Loading date-wise attendance...
            </Typography>
          )}

          {!groupedLoading && groupedDays.length === 0 && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <Typography color="text.secondary">No attendance records found for the selected period.</Typography>
            </Paper>
          )}

          {!groupedLoading && groupedDays.map((dayGroup, idx) => {
            const counts = dayGroup.counts || {};
            return (
              <Accordion
                key={dayGroup.date}
                defaultExpanded={idx === 0 || dayGroup.is_today}
                sx={{
                  mb: 1.5,
                  borderRadius: '12px !important',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'none',
                  '&:before': { display: 'none' },
                  overflow: 'hidden',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: dayGroup.is_today ? '#F0FDF4' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    px: 2.5,
                    py: 1,
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ width: '100%', pr: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        {new Date(dayGroup.date + 'T00:00:00').toLocaleDateString('en-IN', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                      {dayGroup.is_today && (
                        <Chip label="Today" color="success" size="small" sx={{ fontWeight: 700, height: 22 }} />
                      )}
                    </Stack>

                    {/* Summary Counts Bar for that Date */}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Chip
                        icon={<CheckCircle fontSize="small" />}
                        label={`Present: ${counts.present || 0}`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        icon={<Cancel fontSize="small" />}
                        label={`Absent: ${counts.absent || 0}`}
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip
                        icon={<AccessTime fontSize="small" />}
                        label={`Late: ${counts.late || 0}`}
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                      {counts.half_day > 0 && (
                        <Chip
                          icon={<Schedule fontSize="small" />}
                          label={`Half Day: ${counts.half_day}`}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {counts.on_leave > 0 && (
                        <Chip
                          icon={<EventBusy fontSize="small" />}
                          label={`Leave: ${counts.on_leave}`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      <Chip
                        label={`Attendance: ${counts.attendance_percentage ?? 0}%`}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 700 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        ({dayGroup.records?.length || 0} employees)
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Employee</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Department / Role</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Punch In</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Punch Out</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Hours</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Late (min)</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Status</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.78rem' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dayGroup.records?.map((record) => (
                          <TableRow key={record.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {record.first_name} {record.last_name}
                              <Typography variant="caption" display="block" color="text.secondary">
                                {record.employee_code || `EMP-${record.employee_id}`}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{record.department_name || 'General'}</Typography>
                              <Typography variant="caption" color="text.secondary">{record.designation_name || 'Staff'}</Typography>
                            </TableCell>
                            <TableCell>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString('en-IN') : '—'}</TableCell>
                            <TableCell>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString('en-IN') : '—'}</TableCell>
                            <TableCell>{record.total_hours ? `${record.total_hours} hrs` : '—'}</TableCell>
                            <TableCell sx={{ color: Number(record.late_minutes) > 0 ? 'error.main' : 'inherit' }}>
                              {record.late_minutes || 0}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={record.status}
                                size="small"
                                color={
                                  record.status === 'present' ? 'success' :
                                  record.status === 'absent' ? 'error' :
                                  record.status === 'half_day' ? 'info' :
                                  record.status === 'on_leave' ? 'warning' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => { setSelectedRecord(record); setRecordStep(0); }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!dayGroup.records || dayGroup.records.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 2 }}>
                              <Typography variant="caption" color="text.secondary">No records logged for this date.</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      )}

      {/* TAB 1: ALL FLAT RECORDS VIEW */}
      {activeTab === 1 && (
        <Card sx={{ borderRadius: 3, border: '1px solid #E2E8F0' }}>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Employee</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Punch In</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Punch Out</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Hours</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Late (min)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {record.first_name} {record.last_name}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {record.employee_code || `EMP-${record.employee_id}`}
                        </Typography>
                      </TableCell>
                      <TableCell>{new Date(record.work_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString('en-IN') : '—'}</TableCell>
                      <TableCell>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString('en-IN') : '—'}</TableCell>
                      <TableCell>{record.total_hours ? `${record.total_hours} hrs` : '—'}</TableCell>
                      <TableCell sx={{ color: Number(record.late_minutes) > 0 ? 'error.main' : 'inherit' }}>
                        {record.late_minutes || 0}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={record.status}
                          size="small"
                          color={
                            record.status === 'present' ? 'success' :
                            record.status === 'absent' ? 'error' :
                            record.status === 'half_day' ? 'info' :
                            record.status === 'on_leave' ? 'warning' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => { setSelectedRecord(record); setRecordStep(0); }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {recordsLoading ? 'Loading records…' : 'No records found for current filters.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Stepper Detail Dialog */}
      <Dialog open={Boolean(selectedRecord)} onClose={closeRecordDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Attendance Record Details</DialogTitle>
        <DialogContent>
          <Stepper activeStep={recordStep} alternativeLabel sx={{ my: 2 }}>
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
