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
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Edit, Visibility } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import EmployeeProfileDialog from '../../components/EmployeeProfileDialog';

const initialForm = {
  email: '',
  password: '',
  employee_code: '',
  first_name: '',
  last_name: '',
  phone: '',
  department_id: '',
  designation_id: '',
  joining_date: '',
  employment_type: 'full_time',
  date_of_birth: '',
  gender: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact: '',
};

const initialEditForm = {
  first_name: '',
  last_name: '',
  phone: '',
  department_id: '',
  designation_id: '',
  employment_type: 'full_time',
  date_of_birth: '',
  gender: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact: '',
  status: 'active',
};

const selectMenuProps = {
  PaperProps: {
    sx: {
      maxHeight: 320,
      minWidth: 260,
    },
  },
};

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [profileEmployeeId, setProfileEmployeeId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [formData, setFormData] = useState(initialForm);
  const [editFormData, setEditFormData] = useState(initialEditForm);

  const showMessage = (type, text) => setMessage({ type, text });

  const loadData = async () => {
    try {
      const [employeesData, deptData, desigData] = await Promise.all([
        apiRequest('/employees'),
        apiRequest('/organization/departments'),
        apiRequest('/organization/designations'),
      ]);
      setEmployees(employeesData);
      setDepartments(deptData);
      setDesignations(desigData);
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const employeeCountText = useMemo(() => `${employees.length} active records in the workspace`, [employees.length]);

  const validateEmployeeForm = (data, { requirePassword }) => {
    const nextErrors = {};
    if (!data.employee_code?.trim()) nextErrors.employee_code = 'Employee code is required';
    if (!data.first_name?.trim()) nextErrors.first_name = 'First name is required';
    if (!data.last_name?.trim()) nextErrors.last_name = 'Last name is required';
    if (!data.phone?.trim()) nextErrors.phone = 'Phone is required';
    if (!data.department_id) nextErrors.department_id = 'Department is required';
    if (!data.designation_id) nextErrors.designation_id = 'Designation is required';
    if (!data.joining_date && requirePassword) nextErrors.joining_date = 'Joining date is required';
    if (!data.email?.trim() && requirePassword) nextErrors.email = 'Email is required';
    if (requirePassword && (!data.password || data.password.length < 6)) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validateEmployeeForm(formData, { requirePassword: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showMessage('error', 'Please fill all required fields before creating the employee.');
      return;
    }

    try {
      await apiRequest('/employees', { method: 'POST', body: formData });
      setOpenDialog(false);
      setFormData(initialForm);
      setErrors({});
      showMessage('success', 'Employee created successfully.');
      loadData();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleEdit = async () => {
    const nextErrors = validateEmployeeForm(
      { ...editFormData, employee_code: selectedEmployee?.employee_code, joining_date: selectedEmployee?.joining_date },
      { requirePassword: false },
    );
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !selectedEmployee) {
      showMessage('error', 'Please correct the required employee fields.');
      return;
    }

    try {
      await apiRequest(`/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        body: editFormData,
      });
      setOpenEditDialog(false);
      setSelectedEmployee(null);
      setEditFormData(initialEditForm);
      showMessage('success', 'Employee updated successfully.');
      loadData();
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleOpenEdit = (employee) => {
    setSelectedEmployee(employee);
    setEditFormData({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      phone: employee.phone || '',
      department_id: employee.department_id || '',
      designation_id: employee.designation_id || '',
      employment_type: employee.employment_type || 'full_time',
      date_of_birth: employee.date_of_birth ? employee.date_of_birth.split('T')[0] : '',
      gender: employee.gender || '',
      address: employee.address || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact: employee.emergency_contact || '',
      status: employee.status || 'active',
    });
    setEditErrors({});
    setOpenEditDialog(true);
  };

  const renderSelect = (key, label, value, onChange, items, helperText, error) => (
    <TextField
      fullWidth
      select
      label={label}
      value={value}
      onChange={onChange}
      error={Boolean(error)}
      helperText={helperText}
      required={label.includes('*')}
      SelectProps={{ MenuProps: selectMenuProps }}
      sx={{ minWidth: 260 }}
    >
      {items.map((item) => (
        <MenuItem key={item.id} value={item.id}>
          {key === 'department' ? item.name : item.title}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Employee Management
          </Typography>
          <Typography color="text.secondary">{employeeCountText}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)} sx={{ borderRadius: 3 }}>
          Add Employee
        </Button>
      </Box>

      {message.text ? (
        <Alert severity={message.type || 'info'} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      ) : null}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Designation</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>{employee.employee_code}</TableCell>
                    <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.department_name || 'N/A'}</TableCell>
                    <TableCell>{employee.designation_title || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={employee.employment_type} size="small" sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={employee.status || (employee.is_active ? 'active' : 'inactive')}
                        size="small"
                        color={(employee.status || (employee.is_active ? 'active' : 'inactive')) === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View full record">
                        <IconButton size="small" color="primary" onClick={() => setProfileEmployeeId(employee.id)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit employee">
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(employee)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Employee</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Employee Code *" value={formData.employee_code} onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })} error={Boolean(errors.employee_code)} helperText={errors.employee_code} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Email *" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} error={Boolean(errors.email)} helperText={errors.email} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Password *" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} error={Boolean(errors.password)} helperText={errors.password} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Joining Date *" type="date" InputLabelProps={{ shrink: true }} value={formData.joining_date} onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })} error={Boolean(errors.joining_date)} helperText={errors.joining_date} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="First Name *" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} error={Boolean(errors.first_name)} helperText={errors.first_name} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Last Name *" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} error={Boolean(errors.last_name)} helperText={errors.last_name} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="Phone *" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} error={Boolean(errors.phone)} helperText={errors.phone} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderSelect('department', 'Department *', formData.department_id, (e) => setFormData({ ...formData, department_id: e.target.value }), departments, errors.department_id, errors.department_id)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderSelect('designation', 'Designation *', formData.designation_id, (e) => setFormData({ ...formData, designation_id: e.target.value }), designations, errors.designation_id, errors.designation_id)}
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Employment Type" value={formData.employment_type} onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}>
                <MenuItem value="full_time">Full Time</MenuItem>
                <MenuItem value="part_time">Part Time</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="intern">Intern</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Gender" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Emergency Contact Name" value={formData.emergency_contact_name} onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Emergency Contact Number" value={formData.emergency_contact} onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Address" multiline rows={3} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Create Employee</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Employee</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="First Name" value={editFormData.first_name} onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })} error={Boolean(editErrors.first_name)} helperText={editErrors.first_name} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Last Name" value={editFormData.last_name} onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })} error={Boolean(editErrors.last_name)} helperText={editErrors.last_name} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Phone" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} error={Boolean(editErrors.phone)} helperText={editErrors.phone} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Date of Birth" type="date" InputLabelProps={{ shrink: true }} value={editFormData.date_of_birth} onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderSelect('department', 'Department *', editFormData.department_id, (e) => setEditFormData({ ...editFormData, department_id: e.target.value }), departments, editErrors.department_id, editErrors.department_id)}
            </Grid>
            <Grid item xs={12} sm={6}>
              {renderSelect('designation', 'Designation *', editFormData.designation_id, (e) => setEditFormData({ ...editFormData, designation_id: e.target.value }), designations, editErrors.designation_id, editErrors.designation_id)}
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Employment Type" value={editFormData.employment_type} onChange={(e) => setEditFormData({ ...editFormData, employment_type: e.target.value })}>
                <MenuItem value="full_time">Full Time</MenuItem>
                <MenuItem value="part_time">Part Time</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="intern">Intern</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Status" value={editFormData.status} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="terminated">Terminated</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth select label="Gender" value={editFormData.gender} onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Emergency Contact Name" value={editFormData.emergency_contact_name} onChange={(e) => setEditFormData({ ...editFormData, emergency_contact_name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Emergency Contact Number" value={editFormData.emergency_contact} onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Address" multiline rows={3} value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit}>Update Employee</Button>
        </DialogActions>
      </Dialog>

      <EmployeeProfileDialog open={Boolean(profileEmployeeId)} onClose={() => setProfileEmployeeId(null)} employeeId={profileEmployeeId} />
    </Box>
  );
}
