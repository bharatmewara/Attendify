import { useEffect, useState } from 'react';
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
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Snackbar,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const defaultShift = {
  name: '',
  start_time: '09:00',
  end_time: '18:00',
  working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  grace_period_minutes: 15,
  late_penalty_per_minute: 0,
  early_leave_penalty_per_minute: 0,
  min_hours_full_day: 8.0,
  min_hours_half_day: 4.0,
  max_punch_in_time: '',
  is_active: true,
};

const workingDayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ShiftManagement() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState(defaultShift);
  const [assignData, setAssignData] = useState({
    employee_id: '',
    shift_id: '',
    effective_from: new Date().toISOString().split('T')[0],
  });

  const loadData = async () => {
    try {
      const [shiftsData, employeesData] = await Promise.all([
        apiRequest('/shifts'),
        apiRequest('/employees'),
      ]);
      setShifts(shiftsData);
      setEmployees(employeesData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async () => {
    try {
      if (editingShiftId) {
        await apiRequest(`/shifts/${editingShiftId}`, { method: 'PUT', body: formData });
        setMessage({ type: 'success', text: 'Shift updated successfully.' });
      } else {
        await apiRequest('/shifts', { method: 'POST', body: formData });
        setMessage({ type: 'success', text: 'Shift created successfully.' });
      }
      setOpenDialog(false);
      setEditingShiftId(null);
      setFormData(defaultShift);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleAssign = async () => {
    try {
      await apiRequest('/shifts/assign', {
        method: 'POST',
        body: assignData,
      });
      setOpenAssignDialog(false);
      setAssignData({
        employee_id: '',
        shift_id: '',
        effective_from: new Date().toISOString().split('T')[0],
      });
      setMessage({ type: 'success', text: 'Shift assigned successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const openEditShift = (shift) => {
    setEditingShiftId(shift.id);
    setFormData({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      working_days: Array.isArray(shift.working_days) ? shift.working_days : JSON.parse(shift.working_days || '[]'),
      grace_period_minutes: Number(shift.grace_period_minutes || 0),
      late_penalty_per_minute: Number(shift.late_penalty_per_minute || 0),
      early_leave_penalty_per_minute: Number(shift.early_leave_penalty_per_minute || 0),
      min_hours_full_day: Number(shift.min_hours_full_day || 8.0),
      min_hours_half_day: Number(shift.min_hours_half_day || 4.0),
      max_punch_in_time: shift.max_punch_in_time || '',
      is_active: Boolean(shift.is_active),
    });
    setOpenDialog(true);
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/shifts/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Shift deleted successfully.' });
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Shift Management</Typography>
          <Typography color="text.secondary">Create, edit, and assign shifts with penalties and working day controls.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <Button variant="outlined" onClick={() => setOpenAssignDialog(true)}>Assign Shift</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => {
            setEditingShiftId(null);
            setFormData(defaultShift);
            setOpenDialog(true);
          }}>
            Create Shift
          </Button>
        </Box>
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

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Shift Name</TableCell>
                  <TableCell>Timings</TableCell>
                  <TableCell>Working Days</TableCell>
                  <TableCell>Grace Period</TableCell>
                  <TableCell>Penalties</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shifts.map((shift) => {
                  const days = Array.isArray(shift.working_days) ? shift.working_days : JSON.parse(shift.working_days || '[]');
                  return (
                    <TableRow key={shift.id} hover>
                      <TableCell>{shift.name}</TableCell>
                      <TableCell>{shift.start_time} to {shift.end_time}</TableCell>
                      <TableCell>{days.join(', ')}</TableCell>
                      <TableCell>{shift.grace_period_minutes} min</TableCell>
                      <TableCell>Late: Rs. {shift.late_penalty_per_minute}/min | Early: Rs. {shift.early_leave_penalty_per_minute}/min</TableCell>
                      <TableCell><Chip size="small" label={shift.is_active ? 'Active' : 'Inactive'} color={shift.is_active ? 'success' : 'default'} /></TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button size="small" startIcon={<Edit />} onClick={() => openEditShift(shift)}>Edit</Button>
                          <Button size="small" color="error" startIcon={<Delete />} onClick={() => setDeleteConfirm(shift)}>Delete</Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingShiftId ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Shift Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} margin="normal" />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Start Time" type="time" InputLabelProps={{ shrink: true }} value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="End Time" type="time" InputLabelProps={{ shrink: true }} value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} margin="normal" />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                SelectProps={{ multiple: true }}
                label="Working Days"
                value={formData.working_days}
                onChange={(e) => setFormData({ ...formData, working_days: e.target.value })}
                margin="normal"
              >
                {workingDayOptions.map((day) => (
                  <MenuItem key={day} value={day}>{day}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Grace Period (min)" type="number" value={formData.grace_period_minutes} onChange={(e) => setFormData({ ...formData, grace_period_minutes: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Late Penalty / min" type="number" value={formData.late_penalty_per_minute} onChange={(e) => setFormData({ ...formData, late_penalty_per_minute: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Early Leave Penalty / min" type="number" value={formData.early_leave_penalty_per_minute} onChange={(e) => setFormData({ ...formData, early_leave_penalty_per_minute: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>Attendance Rules</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Min Hours for Full Day" type="number" value={formData.min_hours_full_day} onChange={(e) => setFormData({ ...formData, min_hours_full_day: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Min Hours for Half Day" type="number" value={formData.min_hours_half_day} onChange={(e) => setFormData({ ...formData, min_hours_half_day: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Latest Punch-in Time" type="time" InputLabelProps={{ shrink: true }} value={formData.max_punch_in_time} onChange={(e) => setFormData({ ...formData, max_punch_in_time: e.target.value })} margin="normal" />
            </Grid>
          </Grid>
          <FormControlLabel control={<Switch checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />} label="Shift is active" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editingShiftId ? 'Update Shift' : 'Create Shift'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAssignDialog} onClose={() => setOpenAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Shift to Employee</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Employee" value={assignData.employee_id} onChange={(e) => setAssignData({ ...assignData, employee_id: e.target.value })} margin="normal">
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name} ({employee.employee_code})
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth select label="Shift" value={assignData.shift_id} onChange={(e) => setAssignData({ ...assignData, shift_id: e.target.value })} margin="normal">
            {shifts.map((shift) => (
              <MenuItem key={shift.id} value={shift.id}>{shift.name}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Effective From" type="date" InputLabelProps={{ shrink: true }} value={assignData.effective_from} onChange={(e) => setAssignData({ ...assignData, effective_from: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignDialog(false)}>Cancel</Button>
          <Button onClick={handleAssign} variant="contained">Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Shift</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button onClick={() => handleDelete(deleteConfirm?.id)} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
