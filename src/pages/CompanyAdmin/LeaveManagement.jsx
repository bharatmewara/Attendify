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
import { Add, Check, Close, Delete } from '@mui/icons-material';
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

const shellCardSx = {
  borderRadius: 3,
  border: '1px solid rgba(99, 102, 241, 0.12)',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
};

export default function LeaveManagement() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const [tabValue, setTabValue] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [openTypeDialog, setOpenTypeDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [typeForm, setTypeForm] = useState(typeInitial);
  const [assignForm, setAssignForm] = useState({ employee_id: '', leave_type_id: '', days_to_add: 0 });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteLeaveConfirm, setDeleteLeaveConfirm] = useState(null);

  const loadData = async () => {
    try {
      const requestsPromise = apiRequest('/leave/requests');
      const typesPromise = apiRequest('/leave/types');
      const employeePromise = isEmployee ? Promise.resolve([]) : apiRequest('/employees');
      const balancePromise =
        isEmployee ? apiRequest('/leave/balance') : selectedEmployeeId ? apiRequest(`/leave/balance/${selectedEmployeeId}`) : Promise.resolve([]);

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
  }, [selectedEmployeeId, isEmployee]);

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
      if (isEmployee) {
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

  const handleAssignBalance = async () => {
    try {
      if (!assignForm.employee_id || !assignForm.leave_type_id || !assignForm.days_to_add) {
         setMessage({ type: 'error', text: 'All fields are required and days must be greater than 0.' });
         return;
      }
      await apiRequest('/leave/balance', {
        method: 'POST',
        body: assignForm,
      });
      setOpenAssignDialog(false);
      setAssignForm({ employee_id: '', leave_type_id: '', days_to_add: 0 });
      setMessage({ type: 'success', text: 'Leave balance assigned successfully.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDeleteLeave = async (id) => {
    try {
      await apiRequest(`/leave/requests/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Leave request deleted.' });
      setDeleteLeaveConfirm(null);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        <Card
          sx={{
            ...shellCardSx,
            mb: 3,
            overflow: 'hidden',
            background: isEmployee
              ? 'linear-gradient(135deg, #0f766e 0%, #0f766e 35%, #2563eb 100%)'
              : 'linear-gradient(135deg, #111827 0%, #312e81 55%, #4f46e5 100%)',
            color: '#fff',
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                  {isEmployee ? 'My Leave Dashboard' : 'Leave Management'}
                </Typography>
                <Typography sx={{ maxWidth: 620, color: 'rgba(255,255,255,0.8)' }}>
                  {isEmployee
                    ? 'Apply for leave, watch approval status, and track your remaining balance in one place.'
                    : 'Manage leave policies, approvals, and employee balances with a clean review workflow.'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.25 }}>
                {!isEmployee ? (
                  <>
                    <Button variant="outlined" onClick={() => setOpenAssignDialog(true)} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                      Assign Balance
                    </Button>
                    <Button variant="contained" onClick={() => setOpenTypeDialog(true)} sx={{ bgcolor: '#fff', color: '#312e81', '&:hover': { bgcolor: '#eef2ff' } }}>
                      Add Leave Type
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setRequestForm({ ...requestInitial, employee_id: selectedEmployeeId || '' });
                    setOpenRequestDialog(true);
                  }}
                  sx={{ bgcolor: isEmployee ? '#f59e0b' : '#22c55e', '&:hover': { bgcolor: isEmployee ? '#d97706' : '#16a34a' } }}
                >
                  Apply Leave
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {message.text ? (
          <Alert severity={message.type || 'info'} sx={{ mb: 2.5, borderRadius: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
            {message.text}
          </Alert>
        ) : null}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
          {stats.map((stat) => (
            <Card key={stat.label} sx={{ ...shellCardSx, height: '100%', background: 'linear-gradient(180deg, #ffffff 0%, #f8faff 100%)' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Typography color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>{stat.label}</Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, color: '#0f172a' }}>{stat.value}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2.5 }}>
          <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
            <Card sx={shellCardSx}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2.25, borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {isEmployee ? 'My Leave Requests' : 'Leave Request Queue'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isEmployee ? 'Track the approval status of your submitted leave requests.' : 'Approve or reject pending requests and review history.'}
                  </Typography>
                </Box>
                <Box sx={{ px: 2, pt: 1.5 }}>
                  <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)}>
                    <Tab label={`Pending (${pendingRequests.length})`} sx={{ fontWeight: 600 }} />
                    <Tab label={`Approved (${approvedRequests.length})`} sx={{ fontWeight: 600 }} />
                    <Tab label={`Rejected (${rejectedRequests.length})`} sx={{ fontWeight: 600 }} />
                  </Tabs>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ boxShadow: 'none' }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                        {!isEmployee ? <TableCell sx={{ fontWeight: 700 }}>Employee</TableCell> : null}
                        <TableCell sx={{ fontWeight: 700 }}>Leave Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Dates</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Days</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        {!isEmployee ? <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeList.length ? (
                        activeList.map((leave) => (
                          <TableRow key={leave.id} hover>
                            {!isEmployee ? <TableCell sx={{ fontWeight: 600 }}>{leave.first_name} {leave.last_name}</TableCell> : null}
                            <TableCell>{leave.leave_type_name}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>{leave.total_days}</TableCell>
                            <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={leave.reason}>
                              {leave.reason}
                            </TableCell>
                            <TableCell>
                              <Chip label={leave.status} size="small" color={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'error' : 'default'} sx={{ textTransform: 'capitalize', fontWeight: 600, px: 1 }} />
                            </TableCell>
                            {!isEmployee ? (
                              <TableCell align="right">
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                  {tabValue === 0 && (
                                    <>
                                      <Button size="small" variant="contained" startIcon={<Check />} color="success" onClick={() => handleApproveReject(leave.id, 'approved')} sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}>
                                        Approve
                                      </Button>
                                      <Button size="small" variant="outlined" startIcon={<Close />} color="error" onClick={() => handleApproveReject(leave.id, 'rejected')} sx={{ borderRadius: 2, textTransform: 'none' }}>
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  <Button size="small" variant="outlined" startIcon={<Delete />} color="error" onClick={() => setDeleteLeaveConfirm(leave)} sx={{ borderRadius: 2, textTransform: 'none' }}>
                                    Delete
                                  </Button>
                                </Box>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={isEmployee ? 5 : 7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                            <Box sx={{ color: 'text.disabled', mb: 1.5 }}>
                              <Check sx={{ fontSize: 40, opacity: 0.5 }} />
                            </Box>
                            No requests found in this tab.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Card sx={{ ...shellCardSx, height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                  {isEmployee ? 'My Leave Balance' : 'Leave Balance Search'}
                </Typography>
                {!isEmployee ? (
                  <TextField
                    fullWidth
                    select
                    label="Select Employee"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    sx={{ mb: 2.5 }}
                  >
                    <MenuItem value="">Select an employee...</MenuItem>
                    {employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_code})
                      </MenuItem>
                    ))}
                  </TextField>
                ) : null}
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {leaveBalance.length ? (
                    leaveBalance.map((balance) => (
                      <Paper key={balance.id} variant="outlined" sx={{ p: 2, borderRadius: 3, boxShadow: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{balance.leave_type_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Used: {balance.used_days || 0}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="h6" color="primary" sx={{ fontWeight: 800, lineHeight: 1 }}>
                            {balance.remaining_days}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            of {balance.total_days} days
                          </Typography>
                        </Box>
                      </Paper>
                    ))
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary', bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 3 }}>
                      <Typography variant="body2">
                        {isEmployee 
                           ? 'No leave balance found.' 
                           : selectedEmployeeId
                             ? 'No leave balance found for selected employee.'
                             : 'Select an employee to inspect leave balances.'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Box>
            <Card sx={{ ...shellCardSx, height: '100%' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, pt: 3, pb: 2.25, borderBottom: '1px solid rgba(148, 163, 184, 0.18)' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Leave Policies</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isEmployee ? 'Policies available for your leave applications.' : 'Configured leave types for the company.'}
                  </Typography>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ boxShadow: 'none' }}>
                  <Table size="medium">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Policy Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Days / Year</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {leaveTypes.map((type) => (
                        <TableRow key={type.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{type.name}</TableCell>
                          <TableCell>
                            <Chip label={type.code} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>{type.days_per_year}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Leave</DialogTitle>
        <DialogContent>
          {!isEmployee ? (
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
          {!isEmployee ? (
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

      <Dialog open={openAssignDialog} onClose={() => setOpenAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Leave Balance</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Employee" value={assignForm.employee_id} onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })} margin="normal">
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name} ({employee.employee_code})
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth select label="Leave Type" value={assignForm.leave_type_id} onChange={(e) => setAssignForm({ ...assignForm, leave_type_id: e.target.value })} margin="normal">
            {leaveTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name} ({type.code})
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Days to Add" type="number" value={assignForm.days_to_add} onChange={(e) => setAssignForm({ ...assignForm, days_to_add: Number(e.target.value) })} margin="normal" helperText="Total days and remaining days will be increased by this amount." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignDialog(false)}>Cancel</Button>
          <Button onClick={handleAssignBalance} variant="contained">Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Leave Confirm Dialog */}
      <Dialog open={Boolean(deleteLeaveConfirm)} onClose={() => setDeleteLeaveConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Leave Request</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the leave request for <strong>{deleteLeaveConfirm?.first_name} {deleteLeaveConfirm?.last_name}</strong> ({deleteLeaveConfirm?.leave_type_name})? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteLeaveConfirm(null)}>Cancel</Button>
          <Button onClick={() => handleDeleteLeave(deleteLeaveConfirm?.id)} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
