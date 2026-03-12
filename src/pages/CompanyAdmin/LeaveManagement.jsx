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
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Check, Close } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const requestInitial = {
  employee_id: '',
  leave_type_id: '',
  start_date: '',
  end_date: '',
  reason: '',
  status: 'pending',
};

const typeInitial = {
  name: '',
  code: '',
  days_per_year: 12,
  carry_forward: false,
  max_carry_forward_days: 0,
  is_paid: true,
  requires_document: false,
};

export default function LeaveManagement() {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [typeForm, setTypeForm] = useState(typeInitial);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const requestsPromise = apiRequest('/leave/requests');
      const typesPromise = apiRequest('/leave/types');
      const employeePromise = user.role !== 'employee' ? apiRequest('/employees') : Promise.resolve([]);
      const balancePromise =
        user.role === 'employee'
          ? apiRequest('/leave/balance')
          : selectedEmployeeId
          ? apiRequest(`/leave/balance/${selectedEmployeeId}`)
          : Promise.resolve([]);

      const [requestsData, typesData, employeesData, balanceData] = await Promise.all([
        requestsPromise,
        typesPromise,
        employeePromise,
        balancePromise,
      ]);

      setLeaveRequests(requestsData);
      setLeaveTypes(typesData);
      setEmployees(employeesData);
      setLeaveBalance(balanceData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEmployeeId, user.role]);

  const pendingRequests = leaveRequests.filter((item) => item.status === 'pending');
  const approvedRequests = leaveRequests.filter((item) => item.status === 'approved');
  const rejectedRequests = leaveRequests.filter((item) => item.status === 'rejected');
  const activeList = tabValue === 0 ? pendingRequests : tabValue === 1 ? approvedRequests : rejectedRequests;

  const stats = useMemo(
    () => [
      { label: 'Pending', value: pendingRequests.length },
      { label: 'Approved', value: approvedRequests.length },
      { label: 'Rejected', value: rejectedRequests.length },
      { label: 'Policies', value: leaveTypes.length },
    ],
    [pendingRequests.length, approvedRequests.length, rejectedRequests.length, leaveTypes.length],
  );

  const handleApplyLeave = async () => {
    try {
      if (user.role === 'employee') {
        await apiRequest('/leave/requests', { method: 'POST', body: requestForm });
      } else {
        await apiRequest('/leave/requests/admin', { method: 'POST', body: requestForm });
      }

      setOpenRequestDialog(false);
      setRequestForm({ ...requestInitial, employee_id: selectedEmployeeId || '' });
      setMessage({ type: 'success', text: 'Leave request submitted successfully.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleApproveReject = async (id, status) => {
    try {
      await apiRequest(`/leave/requests/${id}`, {
        method: 'PUT',
        body: { status },
      });
      setMessage({ type: 'success', text: `Leave request ${status}.` });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleCreateType = async () => {
    try {
      await apiRequest('/leave/types', {
        method: 'POST',
        body: typeForm,
      });
      setOpenTypeDialog(false);
      setTypeForm(typeInitial);
      setMessage({ type: 'success', text: 'Leave policy created successfully.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Leave Management</Typography>
          <Typography color="text.secondary">Policy setup, leave requests, approvals, and live employee balances in one panel.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          {user.role !== 'employee' ? (
            <Button variant="outlined" onClick={() => setOpenTypeDialog(true)}>
              Add Leave Type
            </Button>
          ) : null}
          <Button variant="contained" startIcon={<Add />} onClick={() => {
            setRequestForm({ ...requestInitial, employee_id: selectedEmployeeId || '' });
            setOpenRequestDialog(true);
          }}>
            Apply Leave
          </Button>
        </Box>
      </Box>

      {message.text ? (
        <Alert severity={message.type || 'info'} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography color="text.secondary">{stat.label}</Typography>
                <Typography variant="h4" fontWeight={800}>{stat.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Leave Balance</Typography>
              {user.role !== 'employee' ? (
                <TextField
                  fullWidth
                  select
                  label="Employee"
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  sx={{ mb: 2 }}
                >
                  <MenuItem value="">Select employee</MenuItem>
                  {employees.map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} ({employee.employee_code})
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {leaveBalance.map((balance) => (
                  <Paper key={balance.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography fontWeight={700}>{balance.leave_type_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {balance.remaining_days} remaining of {balance.total_days} days
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Used: {balance.used_days || 0}
                    </Typography>
                  </Paper>
                ))}
                {leaveBalance.length === 0 ? (
                  <Typography color="text.secondary">
                    {user.role === 'employee' ? 'No leave balance found.' : 'Select an employee to inspect leave balances.'}
                  </Typography>
                ) : null}
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Leave Policies</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Days</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveTypes.map((type) => (
                      <TableRow key={type.id}>
                        <TableCell>{type.name}</TableCell>
                        <TableCell>{type.code}</TableCell>
                        <TableCell>{type.days_per_year}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} sx={{ mb: 2 }}>
                <Tab label={`Pending (${pendingRequests.length})`} />
                <Tab label={`Approved (${approvedRequests.length})`} />
                <Tab label={`Rejected (${rejectedRequests.length})`} />
              </Tabs>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {user.role !== 'employee' ? <TableCell>Employee</TableCell> : null}
                      <TableCell>Leave Type</TableCell>
                      <TableCell>Dates</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Status</TableCell>
                      {user.role !== 'employee' && tabValue === 0 ? <TableCell>Actions</TableCell> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeList.map((leave) => (
                      <TableRow key={leave.id} hover>
                        {user.role !== 'employee' ? <TableCell>{leave.first_name} {leave.last_name}</TableCell> : null}
                        <TableCell>{leave.leave_type_name}</TableCell>
                        <TableCell>
                          {new Date(leave.start_date).toLocaleDateString()} to {new Date(leave.end_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{leave.total_days}</TableCell>
                        <TableCell>{leave.reason}</TableCell>
                        <TableCell>
                          <Chip label={leave.status} size="small" color={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'error' : 'default'} />
                        </TableCell>
                        {user.role !== 'employee' && tabValue === 0 ? (
                          <TableCell>
                            <Button size="small" startIcon={<Check />} color="success" onClick={() => handleApproveReject(leave.id, 'approved')}>
                              Approve
                            </Button>
                            <Button size="small" startIcon={<Close />} color="error" onClick={() => handleApproveReject(leave.id, 'rejected')}>
                              Reject
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Leave</DialogTitle>
        <DialogContent>
          {user.role !== 'employee' ? (
            <TextField fullWidth select label="Employee" value={requestForm.employee_id} onChange={(e) => setRequestForm({ ...requestForm, employee_id: e.target.value })} margin="normal">
              {employees.map((employee) => (
                <MenuItem key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} ({employee.employee_code})
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <TextField fullWidth select label="Leave Type" value={requestForm.leave_type_id} onChange={(e) => setRequestForm({ ...requestForm, leave_type_id: e.target.value })} margin="normal">
            {leaveTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </TextField>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Start Date" type="date" InputLabelProps={{ shrink: true }} value={requestForm.start_date} onChange={(e) => setRequestForm({ ...requestForm, start_date: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="End Date" type="date" InputLabelProps={{ shrink: true }} value={requestForm.end_date} onChange={(e) => setRequestForm({ ...requestForm, end_date: e.target.value })} />
            </Grid>
          </Grid>
          {user.role !== 'employee' ? (
            <TextField fullWidth select label="Initial Status" value={requestForm.status} onChange={(e) => setRequestForm({ ...requestForm, status: e.target.value })} margin="normal">
              <MenuItem value="pending">Pending Approval</MenuItem>
              <MenuItem value="approved">Approve Immediately</MenuItem>
            </TextField>
          ) : null}
          <TextField fullWidth label="Reason" multiline rows={4} value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
          <Button onClick={handleApplyLeave} variant="contained">Submit</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openTypeDialog} onClose={() => setOpenTypeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Leave Policy</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Policy Name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Code" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })} margin="normal" />
          <TextField fullWidth label="Days Per Year" type="number" value={typeForm.days_per_year} onChange={(e) => setTypeForm({ ...typeForm, days_per_year: Number(e.target.value) })} margin="normal" />
          <TextField fullWidth select label="Carry Forward" value={String(typeForm.carry_forward)} onChange={(e) => setTypeForm({ ...typeForm, carry_forward: e.target.value === 'true' })} margin="normal">
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>
          <TextField fullWidth label="Max Carry Forward Days" type="number" value={typeForm.max_carry_forward_days} onChange={(e) => setTypeForm({ ...typeForm, max_carry_forward_days: Number(e.target.value) })} margin="normal" />
          <TextField fullWidth select label="Paid Leave" value={String(typeForm.is_paid)} onChange={(e) => setTypeForm({ ...typeForm, is_paid: e.target.value === 'true' })} margin="normal">
            <MenuItem value="true">Paid</MenuItem>
            <MenuItem value="false">Unpaid</MenuItem>
          </TextField>
          <TextField fullWidth select label="Requires Document" value={String(typeForm.requires_document)} onChange={(e) => setTypeForm({ ...typeForm, requires_document: e.target.value === 'true' })} margin="normal">
            <MenuItem value="false">No</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTypeDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateType} variant="contained">Create Policy</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
