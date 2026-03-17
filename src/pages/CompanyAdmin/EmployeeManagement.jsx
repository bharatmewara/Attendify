import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Stack,
  Badge,
} from '@mui/material';
import { 
  Add, 
  Edit, 
  Visibility, 
  Delete, 
  Upload, 
  AttachFile, 
  Close,
  Person,
  AccountBalance,
  Description,
  EventAvailable,
  Assessment,
  Assignment,
  Download,
  VisibilityOff,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { InputAdornment } from '@mui/material';

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [openResetPasswordDialog, setOpenResetPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [customDocName, setCustomDocName] = useState('');
  const [formData, setFormData] = useState({
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
    aadhar_number: '',
    pan_number: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc: '',
    emergency_contact: '',
    emergency_contact_name: '',
  });
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    department_id: '',
    designation_id: '',
    employment_type: '',
    date_of_birth: '',
    gender: '',
    address: '',
    aadhar_number: '',
    pan_number: '',
    bank_account_number: '',
    bank_name: '',
    bank_ifsc: '',
    emergency_contact: '',
    emergency_contact_name: '',
  });

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
      setMessage(error.message);
    }
  };

  const handleOpenView = async (emp) => {
    try {
      setSelectedEmployee(emp);
      const data = await apiRequest(`/employees/${emp.id}/profile`);
      setViewProfile(data);
      setOpenViewDialog(true);
      setActiveTab(0);
    } catch (error) {
      setMessage(`error:${error.message}`);
    }
  };

  const handleOpenResetPassword = () => {
    setNewPassword('');
    setPasswordError('');
    setOpenResetPasswordDialog(true);
  };

  const handleCloseResetPassword = () => {
    setOpenResetPasswordDialog(false);
  };

  const handleConfirmResetPassword = async () => {
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    try {
      await apiRequest(`/employees/${selectedEmployee.id}/password`, {
        method: 'PUT',
        body: { newPassword },
      });
      setMessage('Password reset successfully');
      handleCloseResetPassword();
    } catch (error) {
      setPasswordError(error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password || formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (!formData.employee_code) newErrors.employee_code = 'Employee code is required';
    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.phone) newErrors.phone = 'Phone is required';
    if (!formData.department_id) newErrors.department_id = 'Department is required';
    if (!formData.designation_id) newErrors.designation_id = 'Designation is required';
    if (!formData.joining_date) newErrors.joining_date = 'Joining date is required';
    if (formData.aadhar_number && formData.aadhar_number.length !== 12) {
      newErrors.aadhar_number = 'Aadhar must be 12 digits';
    }
    if (formData.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan_number)) {
      newErrors.pan_number = 'Invalid PAN format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = async (e, docType) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const label = docType === 'aadhar' ? 'Aadhaar Card' : 'PAN Card';
        const newDoc = {
          document_type: docType,
          document_name: label,
          file_name: file.name,
          file_size: file.size,
          file_url: dataUrl,
        };
        setUploadedDocs((current) => [...current.filter((doc) => doc.document_type !== docType), newDoc]);
      } catch (error) {
        setMessage(error.message);
      }
    }
  };

  const handleCustomDocUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) {
      if (!customDocName.trim()) {
        setMessage('Enter the document name before uploading the file');
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        const newDoc = {
          document_type: 'other',
          document_name: customDocName.trim(),
          file_name: file.name,
          file_size: file.size,
          file_url: dataUrl,
        };
        setUploadedDocs((current) => [...current, newDoc]);
        setCustomDocName('');
      } catch (error) {
        setMessage(error.message);
      }
    }
  };

  const removeDocument = (index) => {
    const newDocs = uploadedDocs.filter((_, i) => i !== index);
    setUploadedDocs(newDocs);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setMessage('Please fill all required fields correctly');
      return;
    }

    try {
      await apiRequest('/employees', {
        method: 'POST',
        body: {
          ...formData,
          documents: uploadedDocs,
        },
      });

      setOpenDialog(false);
      setFormData({
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
        aadhar_number: '',
        pan_number: '',
        bank_account_number: '',
        bank_name: '',
        bank_ifsc: '',
        emergency_contact: '',
        emergency_contact_name: '',
      });
      setUploadedDocs([]);
      setCustomDocName('');
      setErrors({});
      setMessage('Employee created successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEdit = async () => {
    try {
      await apiRequest(`/employees/${selectedEmployee.id}`, {
        method: 'PUT',
        body: editFormData,
      });
      setOpenEditDialog(false);
      setMessage('Employee updated successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleOpenEdit = (employee) => {
    setSelectedEmployee(employee);
    setEditFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone || '',
      department_id: employee.department_id || '',
      designation_id: employee.designation_id || '',
      employment_type: employee.employment_type,
      date_of_birth: employee.date_of_birth || '',
      gender: employee.gender || '',
      address: employee.address || '',
      aadhar_number: employee.aadhar_number || '',
      pan_number: employee.pan_number || '',
      bank_account_number: employee.bank_account_number || '',
      bank_name: employee.bank_name || '',
      bank_ifsc: employee.bank_ifsc || '',
      emergency_contact: employee.emergency_contact || '',
      emergency_contact_name: employee.emergency_contact_name || '',
    });
    setOpenEditDialog(true);
  };

  const handleOpenDelete = (employee) => {
    setSelectedEmployee(employee);
    setOpenDeleteDialog(true);
  };

  const handleDelete = async () => {
    try {
      await apiRequest(`/employees/${selectedEmployee.id}`, { method: 'DELETE' });
      setOpenDeleteDialog(false);
      setMessage('Employee deleted successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Employee Management</Typography>
        <Button 
          variant="contained" 
          startIcon={<Add />} 
          onClick={() => setOpenDialog(true)}
          sx={{ borderRadius: 2 }}
        >
          Add Employee
        </Button>
      </Box>

      {message && (
        <Alert severity={message.includes('success') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Login ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Department</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Designation</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                    <TableCell>{emp.employee_code}</TableCell>
                    <TableCell>{`${emp.first_name} ${emp.last_name}`}</TableCell>
                    <TableCell>
                      {emp.email ? `${emp.email.split('@')[0].slice(0, 3)}***@${emp.email.split('@')[1]}` : 'N/A'}
                    </TableCell>
                    <TableCell>{emp.department_name || 'N/A'}</TableCell>
                    <TableCell>{emp.designation_title || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={emp.employment_type} size="small" sx={{ textTransform: 'capitalize' }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={emp.is_active ? 'Active' : 'Inactive'}
                        color={emp.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton size="small" color="primary" onClick={() => handleOpenView(emp)}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(emp)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDelete(emp)}>
                          <Delete fontSize="small" />
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

      {/* Add Employee Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>Add New Employee</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} color="primary">
                Basic Information
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Employee Code *"
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                error={!!errors.employee_code}
                helperText={errors.employee_code}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={!!errors.email}
                helperText={errors.email}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                error={!!errors.password}
                helperText={errors.password}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="First Name *"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                error={!!errors.first_name}
                helperText={errors.first_name}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Last Name *"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                error={!!errors.last_name}
                helperText={errors.last_name}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Phone *"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                error={!!errors.phone}
                helperText={errors.phone}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Date of Birth"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                label="Gender"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Joining Date *"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.joining_date}
                onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                error={!!errors.joining_date}
                helperText={errors.joining_date}
                required
              />
            </Grid>

            {/* Employment Details */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" sx={{ mt: 2 }}>
                Employment Details
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                label="Department *"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                error={!!errors.department_id}
                helperText={errors.department_id}
                required
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  },
                }}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                label="Designation *"
                value={formData.designation_id}
                onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                error={!!errors.designation_id}
                helperText={errors.designation_id}
                required
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  },
                }}
              >
                {designations.map((desig) => (
                  <MenuItem key={desig.id} value={desig.id}>
                    {desig.title}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                select
                label="Employment Type *"
                value={formData.employment_type}
                onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
              >
                <MenuItem value="full_time">Full Time</MenuItem>
                <MenuItem value="part_time">Part Time</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="intern">Intern</MenuItem>
              </TextField>
            </Grid>

            {/* Identity & Bank Details */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" sx={{ mt: 2 }}>
                Identity & Bank Details
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Aadhar Number"
                value={formData.aadhar_number}
                onChange={(e) => setFormData({ ...formData, aadhar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                error={!!errors.aadhar_number}
                helperText={errors.aadhar_number || '12 digit Aadhar number'}
                inputProps={{ maxLength: 12 }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="PAN Number"
                value={formData.pan_number}
                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value.toUpperCase() })}
                error={!!errors.pan_number}
                helperText={errors.pan_number || 'Format: ABCDE1234F'}
                inputProps={{ maxLength: 10 }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Bank Account Number"
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Bank Name"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="IFSC Code"
                value={formData.bank_ifsc}
                onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                inputProps={{ maxLength: 11 }}
              />
            </Grid>

            {/* Emergency Contact */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" sx={{ mt: 2 }}>
                Emergency Contact
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Name"
                value={formData.emergency_contact_name}
                onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Number"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>

            {/* Document Upload Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} color="primary" sx={{ mt: 2 }}>
                Document Upload
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                component="label"
                startIcon={<Upload />}
                sx={{ height: 56 }}
              >
                Upload Aadhar Card
                <input
                  type="file"
                  hidden
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e, 'aadhar')}
                />
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                component="label"
                startIcon={<Upload />}
                sx={{ height: 56 }}
              >
                Upload PAN Card
                <input
                  type="file"
                  hidden
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileUpload(e, 'pan')}
                />
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Other Document Name"
                value={customDocName}
                onChange={(e) => setCustomDocName(e.target.value)}
                placeholder="Example: Driving License"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                component="label"
                startIcon={<AttachFile />}
                sx={{ height: 56 }}
                disabled={!customDocName.trim()}
              >
                Upload Other Document
                <input
                  type="file"
                  hidden
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleCustomDocUpload}
                />
              </Button>
            </Grid>

            {uploadedDocs.length > 0 && (
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                      Uploaded Documents
                    </Typography>
                    <List dense>
                      {uploadedDocs.map((doc, index) => (
                        <ListItem key={index}>
                          <ListItemText
                            primary={doc.document_name}
                            secondary={doc.file_name}
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={() => removeDocument(index)}>
                              <Close />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Create Employee
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Employee Dialog - Similar structure with edit fields */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>Edit Employee</Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="First Name"
                value={editFormData.first_name}
                onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={editFormData.last_name}
                onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Aadhar Number"
                value={editFormData.aadhar_number}
                onChange={(e) => setEditFormData({ ...editFormData, aadhar_number: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PAN Number"
                value={editFormData.pan_number}
                onChange={(e) => setEditFormData({ ...editFormData, pan_number: e.target.value.toUpperCase() })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Department"
                value={editFormData.department_id}
                onChange={(e) => setEditFormData({ ...editFormData, department_id: e.target.value })}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  },
                }}
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Designation"
                value={editFormData.designation_id}
                onChange={(e) => setEditFormData({ ...editFormData, designation_id: e.target.value })}
                SelectProps={{
                  MenuProps: {
                    PaperProps: {
                      style: {
                        maxHeight: 300,
                      },
                    },
                  },
                }}
              >
                {designations.map((desig) => (
                  <MenuItem key={desig.id} value={desig.id}>
                    {desig.title}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Employment Type"
                value={editFormData.employment_type}
                onChange={(e) => setEditFormData({ ...editFormData, employment_type: e.target.value })}
              >
                <MenuItem value="full_time">Full Time</MenuItem>
                <MenuItem value="part_time">Part Time</MenuItem>
                <MenuItem value="contract">Contract</MenuItem>
                <MenuItem value="intern">Intern</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained">
            Update Employee
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm">
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete employee <strong>{selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''}</strong>?
            This action cannot be undone and will also delete their user account.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            Delete Employee
          </Button>
        </DialogActions>
      </Dialog>
      {/* View Employee Details Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Person sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h6" component="div" fontWeight={700}>
                  {viewProfile?.employee?.first_name} {viewProfile?.employee?.last_name}
                </Typography>
                <Typography variant="caption">{viewProfile?.employee?.employee_code} • {viewProfile?.employee?.designation_title}</Typography>
              </Box>
            </Stack>
            <IconButton color="inherit" onClick={() => setOpenViewDialog(false)}>
              <Close />
            </IconButton>
          </Box>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto" sx={{ bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
            <Tab label="Profile" />
            <Tab label="Bank & Legal" />
            <Tab label="Attendance" />
            <Tab label="Leave History" />
            <Tab label="Documents" />
            <Tab label="Salary & Shift" />
          </Tabs>
        </DialogTitle>
        <DialogContent sx={{ mt: 2, minHeight: 400 }}>
          {viewProfile && (
            <>
              {activeTab === 0 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Full Name</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.first_name} {viewProfile.employee.last_name}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Email Address</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.email}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Phone</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.phone || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Authentication</Typography>
                    <Button
                      variant="outlined"
                      onClick={handleOpenResetPassword}
                    >
                      Reset Password
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="overline" color="text.secondary">Department</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.department_name}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="overline" color="text.secondary">Designation</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.designation_title}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="overline" color="text.secondary">Date of Birth</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.date_of_birth ? new Date(viewProfile.employee.date_of_birth).toLocaleDateString() : 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="overline" color="text.secondary">Gender</Typography>
                    <Typography variant="body1" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{viewProfile.employee.gender || 'N/A'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="overline" color="text.secondary">Joining Date</Typography>
                    <Typography variant="body1" fontWeight={600}>{new Date(viewProfile.employee.joining_date).toLocaleDateString()}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="overline" color="text.secondary">Address</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.address || 'N/A'}</Typography>
                  </Grid>
                </Grid>
              )}

              {activeTab === 1 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Bank Name</Typography>
                    <Typography variant="body1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><AccountBalance fontSize="small" color="action" /> {viewProfile.employee.bank_name || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Account Number</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.bank_account_number || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">IFSC Code</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.bank_ifsc || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">Aadhaar Number</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.aadhar_number || 'Not provided'}</Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="overline" color="text.secondary">PAN Number</Typography>
                    <Typography variant="body1" fontWeight={600}>{viewProfile.employee.pan_number || 'Not provided'}</Typography>
                  </Grid>
                </Grid>
              )}

              {activeTab === 2 && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption" display="block" color="text.secondary">Present</Typography>
                        <Typography variant="h5" fontWeight={700} color="success.main">{viewProfile.attendance.summary.present_count}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption" display="block" color="text.secondary">Absent</Typography>
                        <Typography variant="h5" fontWeight={700} color="error.main">{viewProfile.attendance.summary.absent_count}</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={4}>
                      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="caption" display="block" color="text.secondary">On Leave</Typography>
                        <Typography variant="h5" fontWeight={700} color="info.main">{viewProfile.attendance.summary.leave_count}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  <Typography variant="subtitle2" gutterBottom fontWeight={700}>Recent Logs</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Punch In</TableCell><TableCell>Punch Out</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                      <TableBody>
                        {viewProfile.attendance.records.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell>{new Date(rec.work_date).toLocaleDateString()}</TableCell>
                            <TableCell>{rec.punch_in ? new Date(`2000-01-01T${rec.punch_in}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                            <TableCell>{rec.punch_out ? new Date(`2000-01-01T${rec.punch_out}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                            <TableCell><Chip label={rec.status} size="small" variant="outlined" color={rec.status === 'present' ? 'success' : 'default'} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {activeTab === 3 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight={700}>Leave Balances</Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 3, overflowX: 'auto', pb: 1 }}>
                    {viewProfile.leave.balances.map(bal => (
                      <Paper key={bal.id} variant="outlined" sx={{ p: 1.5, minWidth: 120 }}>
                        <Typography variant="caption" color="text.secondary">{bal.leave_type_name}</Typography>
                        <Typography variant="h6" fontWeight={700}>{bal.remaining_days}/{bal.total_days}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                  <Typography variant="subtitle2" gutterBottom fontWeight={700}>Recent Requests</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead><TableRow><TableCell>Type</TableCell><TableCell>Dates</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                      <TableBody>
                        {viewProfile.leave.requests.map(req => (
                          <TableRow key={req.id}>
                            <TableCell>{req.leave_type_name}</TableCell>
                            <TableCell>{new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}</TableCell>
                            <TableCell><Chip label={req.status} size="small" color={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {activeTab === 4 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom fontWeight={700}>Submitted Documents</Typography>
                  <Grid container spacing={2}>
                    {viewProfile.documents?.length === 0 ? (
                      <Grid item xs={12}><Typography color="text.secondary" align="center">No documents uploaded for this employee.</Typography></Grid>
                    ) : (
                      viewProfile.documents.map(doc => (
                        <Grid item xs={12} sm={6} key={doc.id}>
                          <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Description color="primary" />
                              <Box>
                                <Typography variant="body2" fontWeight={600}>{doc.document_name}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{doc.document_type || 'other'}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(doc.uploaded_at).toLocaleDateString()}
                                </Typography>
                              </Box>
                            </Stack>
                            <IconButton 
                              color="primary" 
                              onClick={() => window.open(doc.file_url, '_blank')} 
                              size="small"
                              disabled={!doc.file_url}
                            >
                              <Visibility />
                            </IconButton>
                          </Paper>
                        </Grid>
                      ))
                    )}
                    {viewProfile.documents?.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Documents uploaded via Employee Management. View all in HR Documents page.
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}

              {activeTab === 5 && (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Salary Structure</Typography>
                    {viewProfile.salary ? (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Basic Salary:</Typography><Typography variant="body2" fontWeight={700}>₹{viewProfile.salary.basic_salary}</Typography></Box>
                          <Divider />
                          <Typography variant="caption" color="text.secondary">Effective from: {new Date(viewProfile.salary.effective_from).toLocaleDateString()}</Typography>
                        </Stack>
                      </Paper>
                    ) : <Typography color="text.secondary">No salary pattern set</Typography>}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="primary" gutterBottom fontWeight={700}>Shift Details</Typography>
                    {viewProfile.shift ? (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Shift Name:</Typography><Typography variant="body2" fontWeight={700}>{viewProfile.shift.name}</Typography></Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Timings:</Typography><Typography variant="body2" fontWeight={700}>{viewProfile.shift.start_time} - {viewProfile.shift.end_time}</Typography></Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2">Working Days:</Typography><Typography variant="body2" sx={{ textAlign: 'right', fontSize: '0.75rem' }} fontWeight={600}>{Array.isArray(viewProfile.shift.working_days) ? viewProfile.shift.working_days.join(', ') : viewProfile.shift.working_days}</Typography></Box>
                        </Stack>
                      </Paper>
                    ) : <Typography color="text.secondary">No shift assigned</Typography>}
                  </Grid>
                </Grid>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openResetPasswordDialog} onClose={handleCloseResetPassword} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          <Typography>
            Resetting password for <strong>{selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''}</strong>.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="New Password"
            type={showNewPassword ? 'text' : 'password'}
            fullWidth
            variant="standard"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResetPassword}>Cancel</Button>
          <Button onClick={handleConfirmResetPassword} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
