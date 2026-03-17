import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Stack,
  Select,
  FormControl,
  InputLabel,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Business,
  MoreVert,
  Block,
  CheckCircle,
  Settings,
  Visibility,
  Edit,
  Notifications as NotificationsIcon,
  LockReset,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const getInitialCompanyFormData = () => ({
  company_name: '',
  company_code: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  industry: '',
  admin_email: '',
  admin_password: '',
  confirm_password: '',
  plan_id: '',
  payment_status: 'paid',
  billing_cycle: 'monthly',
});

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openSubscriptionDialog, setOpenSubscriptionDialog] = useState(false);
  const [openNotificationDialog, setOpenNotificationDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [formData, setFormData] = useState(getInitialCompanyFormData);
  const [editFormData, setEditFormData] = useState({
    company_name: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    industry: '',
  });
  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [notificationData, setNotificationData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'normal',
  });

  async function loadData() {
    try {
      const [companiesData, plansData] = await Promise.all([
        apiRequest('/superadmin/companies'),
        apiRequest('/superadmin/subscription-plans'),
      ]);
      setCompanies(companiesData);
      setPlans(plansData);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (formData.admin_password !== formData.confirm_password) {
      setMessage('Admin passwords do not match');
      return;
    }

    if (formData.admin_password.length < 6) {
      setMessage('Admin password must be at least 6 characters');
      return;
    }

    try {
      await apiRequest('/superadmin/companies', {
        method: 'POST',
        body: formData,
      });
      setOpenDialog(false);
      setFormData(getInitialCompanyFormData());
      setMessage('Company created successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEdit = async () => {
    try {
      await apiRequest(`/superadmin/companies/${selectedCompany.id}`, {
        method: 'PUT',
        body: editFormData,
      });
      setOpenEditDialog(false);
      setMessage('Company updated successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleOpenEdit = (company) => {
    setSelectedCompany(company);
    setEditFormData({
      company_name: company.company_name,
      email: company.email,
      phone: company.phone || '',
      address: company.address || '',
      website: company.website || '',
      industry: company.industry || '',
    });
    setOpenEditDialog(true);
    handleMenuClose();
  };

  const handleResetPassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage('Passwords do not match');
      return;
    }
    if (passwordData.new_password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }
    try {
      await apiRequest(`/superadmin/companies/${selectedCompany.id}/reset-password`, {
        method: 'POST',
        body: { new_password: passwordData.new_password },
      });
      setOpenPasswordDialog(false);
      setPasswordData({ new_password: '', confirm_password: '' });
      setMessage('Password reset successfully');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleOpenPasswordReset = (company) => {
    setSelectedCompany(company);
    setOpenPasswordDialog(true);
    handleMenuClose();
  };

  const handleToggleStatus = async (companyId, isActive) => {
    try {
      await apiRequest(`/superadmin/companies/${companyId}`, {
        method: 'PUT',
        body: { is_active: !isActive },
      });
      setMessage(`Company ${!isActive ? 'activated' : 'deactivated'} successfully`);
      loadData();
      handleMenuClose();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleToggleSubscription = async (companyId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await apiRequest(`/superadmin/companies/${companyId}`, {
        method: 'PUT',
        body: { subscription_status: newStatus },
      });
      setMessage(`Subscription ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      loadData();
      handleMenuClose();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSendNotification = async () => {
    try {
      await apiRequest('/superadmin/notifications', {
        method: 'POST',
        body: {
          company_id: selectedCompany.id,
          ...notificationData,
        },
      });
      setOpenNotificationDialog(false);
      setNotificationData({
        title: '',
        message: '',
        type: 'info',
        priority: 'normal',
      });
      setMessage('Notification sent successfully');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleMenuClick = (event, company) => {
    setAnchorEl(event.currentTarget);
    setSelectedCompany(company);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleViewSubscription = (company) => {
    setSelectedCompany(company);
    setOpenSubscriptionDialog(true);
    handleMenuClose();
  };

  const handleOpenNotification = (company) => {
    setSelectedCompany(company);
    setOpenNotificationDialog(true);
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'trial': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
            Companies
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage all companies on your platform
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setFormData(getInitialCompanyFormData());
            setOpenDialog(true);
          }}
          sx={{
            borderRadius: 2,
            px: 3,
            py: 1.5,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
            },
          }}
        >
          Add Company
        </Button>
      </Box>

      <Snackbar 
        open={Boolean(message)} 
        autoHideDuration={6000} 
        onClose={() => setMessage('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity={message.includes('success') ? 'success' : 'error'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message}
        </Alert>
      </Snackbar>

      <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell sx={{ fontWeight: 600, py: 2 }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Contact</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Employees</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subscription</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companies.map((company) => (
                  <TableRow 
                    key={company.id}
                    sx={{ 
                      '&:hover': { bgcolor: 'grey.25' },
                      borderBottom: '1px solid',
                      borderColor: 'grey.100'
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar
                          sx={{
                            bgcolor: 'primary.main',
                            width: 40,
                            height: 40,
                          }}
                        >
                          <Business />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {company.company_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {company.company_code}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{company.email}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {company.phone}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={company.employee_count || 0}
                        size="small"
                        sx={{ bgcolor: 'primary.50', color: 'primary.700' }}
                      />
                    </TableCell>
                    <TableCell>
                      {company.plan_name ? (
                        <Chip
                          label={company.plan_name}
                          size="small"
                          color="secondary"
                          onClick={() => handleViewSubscription(company)}
                          sx={{ cursor: 'pointer', borderRadius: 2 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">No Plan</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={company.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={company.is_active ? 'success' : 'error'}
                        sx={{ borderRadius: 2 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={company.subscription_status || 'trial'}
                        size="small"
                        color={getStatusColor(company.subscription_status)}
                        sx={{ borderRadius: 2, textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleMenuClick(e, company)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 220 }
        }}
      >
        <MenuItem onClick={() => handleViewSubscription(selectedCompany)}>
          <Visibility sx={{ mr: 2 }} />
          View Subscription
        </MenuItem>
        <MenuItem onClick={() => handleOpenEdit(selectedCompany)}>
          <Edit sx={{ mr: 2 }} />
          Edit Company
        </MenuItem>
        <MenuItem onClick={() => handleOpenPasswordReset(selectedCompany)}>
          <LockReset sx={{ mr: 2 }} />
          Reset Password
        </MenuItem>
        <MenuItem onClick={() => handleOpenNotification(selectedCompany)}>
          <NotificationsIcon sx={{ mr: 2 }} />
          Send Notification
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => handleToggleStatus(selectedCompany?.id, selectedCompany?.is_active)}
        >
          {selectedCompany?.is_active ? (
            <>
              <Block sx={{ mr: 2 }} />
              Deactivate Company
            </>
          ) : (
            <>
              <CheckCircle sx={{ mr: 2 }} />
              Activate Company
            </>
          )}
        </MenuItem>
        <MenuItem
          onClick={() => handleToggleSubscription(selectedCompany?.id, selectedCompany?.subscription_status)}
        >
          <Settings sx={{ mr: 2 }} />
          {selectedCompany?.subscription_status === 'active' ? 'Suspend' : 'Activate'} Subscription
        </MenuItem>
      </Menu>

      {/* Create Company Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setFormData(getInitialCompanyFormData());
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" component="div" fontWeight={600}>
            {selectedCompany ? 'Edit Company' : 'Add New Company'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Code"
                value={formData.company_code}
                onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                helperText="Optional. Leave blank to auto-generate from company name."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1 }}>
                Company Admin Access
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Admin Email"
                type="email"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Admin Password"
                type="password"
                value={formData.admin_password}
                onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Confirm Admin Password"
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1 }}>
                Subscription Setup
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="company-plan-label">Plan</InputLabel>
                <Select
                  labelId="company-plan-label"
                  label="Plan"
                  value={formData.plan_id}
                  onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                >
                  <MenuItem value="">
                    <em>No Plan</em>
                  </MenuItem>
                  {plans.map((plan) => (
                    <MenuItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" disabled={!formData.plan_id}>
                <InputLabel id="payment-status-label">Payment Status</InputLabel>
                <Select
                  labelId="payment-status-label"
                  label="Payment Status"
                  value={formData.payment_status}
                  onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                >
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" disabled={!formData.plan_id}>
                <InputLabel id="billing-cycle-label">Billing Cycle</InputLabel>
                <Select
                  labelId="billing-cycle-label"
                  label="Billing Cycle"
                  value={formData.billing_cycle}
                  onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => {
              setOpenDialog(false);
              setFormData(getInitialCompanyFormData());
            }}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Create Company
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h5" fontWeight={600}>
            Edit Company
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={editFormData.company_name}
                onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                required
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
                label="Website"
                value={editFormData.website}
                onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={editFormData.industry}
                onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={3}
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenEditDialog(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button 
            onClick={handleEdit} 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Update Company
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={openPasswordDialog} onClose={() => setOpenPasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>Reset Company Admin Password</Typography>
          <Typography variant="caption" color="text.secondary">
            Company: {selectedCompany?.company_name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="New Password"
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPasswordDialog(false)}>Cancel</Button>
          <Button onClick={handleResetPassword} variant="contained" color="error">
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Subscription Details Dialog */}
      <Dialog open={openSubscriptionDialog} onClose={() => setOpenSubscriptionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>Subscription Details</Typography>
        </DialogTitle>
        <DialogContent>
          {selectedCompany && (
            <Box sx={{ pt: 2 }}>
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography variant="body1" fontWeight={600}>{selectedCompany.company_name}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Plan Name</Typography>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    {selectedCompany.plan_name || 'No Plan'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Billing Cycle</Typography>
                  <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                    {selectedCompany.billing_cycle || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="h6" fontWeight={600}>
                    ₹{selectedCompany.subscription_amount || 0}
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Start Date</Typography>
                    <Typography variant="body2">
                      {selectedCompany.start_date ? new Date(selectedCompany.start_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">End Date</Typography>
                    <Typography variant="body2">
                      {selectedCompany.end_date ? new Date(selectedCompany.end_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Grid>
                </Grid>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={selectedCompany.subscription_status || 'trial'}
                      size="small"
                      color={getStatusColor(selectedCompany.subscription_status)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>
                {selectedCompany.plan_features && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Features Enabled</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                      {Object.entries(selectedCompany.plan_features).map(([key, value]) => (
                        value && (
                          <Chip
                            key={key}
                            label={key}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ textTransform: 'capitalize', mb: 0.5 }}
                          />
                        )
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSubscriptionDialog(false)} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Send Notification Dialog */}
      <Dialog open={openNotificationDialog} onClose={() => setOpenNotificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={600}>Send Notification</Typography>
          <Typography variant="caption" color="text.secondary">
            To: {selectedCompany?.company_name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={notificationData.title}
              onChange={(e) => setNotificationData({ ...notificationData, title: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Message"
              multiline
              rows={4}
              value={notificationData.message}
              onChange={(e) => setNotificationData({ ...notificationData, message: e.target.value })}
              required
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={notificationData.type}
                label="Type"
                onChange={(e) => setNotificationData({ ...notificationData, type: e.target.value })}
              >
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="error">Error</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={notificationData.priority}
                label="Priority"
                onChange={(e) => setNotificationData({ ...notificationData, priority: e.target.value })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenNotificationDialog(false)}>Cancel</Button>
          <Button onClick={handleSendNotification} variant="contained">
            Send Notification
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
