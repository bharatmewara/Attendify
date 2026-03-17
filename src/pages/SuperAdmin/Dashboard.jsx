import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
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
  Switch,
  FormControlLabel,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
} from '@mui/material';
import {
  Business,
  People,
  AttachMoney,
  TrendingUp,
  Block,
  CheckCircle,
  Settings,
  Visibility,
  Edit,
  Add,
  Delete,
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

export default function SuperAdminDashboard() {
  const [tabValue, setTabValue] = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [openSubscriptionDialog, setOpenSubscriptionDialog] = useState(false);
  const [openDeletePlanDialog, setOpenDeletePlanDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState(getInitialCompanyFormData);
  const [planData, setPlanData] = useState({
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    employee_limit: '',
    features: {
      attendance: true,
      leave: true,
      payroll: false,
      documents: false,
      reports: false,
    },
  });

  async function loadData() {
    try {
      const [analyticsData, companiesData, plansData] = await Promise.all([
        apiRequest('/superadmin/analytics'),
        apiRequest('/superadmin/companies'),
        apiRequest('/superadmin/subscription-plans'),
      ]);
      setAnalytics(analyticsData);
      setCompanies(companiesData);
      setPlans(plansData);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async () => {
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

  const handleCreateOrUpdatePlan = async () => {
    try {
      if (editingPlan) {
        await apiRequest(`/superadmin/subscription-plans/${editingPlan.id}`, {
          method: 'PUT',
          body: planData,
        });
        setMessage('Plan updated successfully');
      } else {
        await apiRequest('/superadmin/subscription-plans', {
          method: 'POST',
          body: planData,
        });
        setMessage('Plan created successfully');
      }
      setOpenPlanDialog(false);
      setEditingPlan(null);
      setPlanData({
        name: '',
        description: '',
        price_monthly: '',
        price_yearly: '',
        employee_limit: '',
        features: {
          attendance: true,
          leave: true,
          payroll: false,
          documents: false,
          reports: false,
        },
      });
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleToggleCompany = async (companyId, isActive) => {
    try {
      await apiRequest(`/superadmin/companies/${companyId}`, {
        method: 'PUT',
        body: { is_active: !isActive },
      });
      setMessage(`Company ${!isActive ? 'activated' : 'deactivated'} successfully`);
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanData({
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      employee_limit: plan.employee_limit,
      features: plan.features || {
        attendance: true,
        leave: true,
        payroll: false,
        documents: false,
        reports: false,
      },
    });
    setOpenPlanDialog(true);
  };

  const handleViewSubscription = (company) => {
    setSelectedCompany(company);
    setOpenSubscriptionDialog(true);
  };

  const handleOpenDeletePlan = (plan) => {
    setPlanToDelete(plan);
    setOpenDeletePlanDialog(true);
  };

  const handleDeletePlan = async () => {
    try {
      await apiRequest(`/superadmin/subscription-plans/${planToDelete.id}`, {
        method: 'DELETE',
      });
      setOpenDeletePlanDialog(false);
      setPlanToDelete(null);
      setMessage('Plan deleted successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const statCards = [
    {
      title: 'Active Companies',
      value: analytics?.active_companies || 0,
      icon: <Business sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: 'Total Employees',
      value: analytics?.total_employees || 0,
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
    },
    {
      title: 'Active Users',
      value: analytics?.active_users || 0,
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
    },
    {
      title: 'Monthly Revenue',
      value: `₹${analytics?.monthly_revenue || 0}`,
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
        Super Admin Dashboard
      </Typography>

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

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>{stat.value}</Typography>
                  </Box>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label="Companies" />
              <Tab label="Subscription Plans" />
            </Tabs>
            <Box>
              {tabValue === 0 && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setFormData(getInitialCompanyFormData());
                    setOpenDialog(true);
                  }}
                >
                  Add Company
                </Button>
              )}
              {tabValue === 1 && (
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenPlanDialog(true)}>
                  Add Plan
                </Button>
              )}
            </Box>
          </Box>

          {tabValue === 0 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Employees</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <TableCell>{company.company_name}</TableCell>
                      <TableCell>{company.company_code}</TableCell>
                      <TableCell>{company.email}</TableCell>
                      <TableCell>
                        <Chip label={company.employee_count || 0} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        {company.plan_name ? (
                          <Chip
                            label={company.plan_name}
                            size="small"
                            color="secondary"
                            onClick={() => handleViewSubscription(company)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ) : (
                          'No Plan'
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={company.is_active ? 'Active' : 'Inactive'}
                          color={company.is_active ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={company.is_active ? <Block /> : <CheckCircle />}
                          color={company.is_active ? 'error' : 'success'}
                          onClick={() => handleToggleCompany(company.id, company.is_active)}
                        >
                          {company.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Plan Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Monthly Price</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Yearly Price</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Employee Limit</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Features</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                      <TableCell>{plan.name}</TableCell>
                      <TableCell>₹{plan.price_monthly}</TableCell>
                      <TableCell>₹{plan.price_yearly}</TableCell>
                      <TableCell>{plan.employee_limit}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {Object.entries(plan.features || {}).map(([key, value]) => (
                            value && (
                              <Chip
                                key={key}
                                label={key}
                                size="small"
                                sx={{ textTransform: 'capitalize', mb: 0.5 }}
                              />
                            )
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={plan.is_active ? 'Active' : 'Inactive'}
                          color={plan.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditPlan(plan)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleOpenDeletePlan(plan)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

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
        <DialogTitle>Add New Company</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company Code"
                value={formData.company_code}
                onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                margin="normal"
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
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                margin="normal"
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
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
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
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Admin Password"
                type="password"
                value={formData.admin_password}
                onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Confirm Admin Password"
                type="password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                Subscription Setup
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth margin="normal" size="small">
                <InputLabel id="dashboard-company-plan-label">Plan</InputLabel>
                <Select
                  labelId="dashboard-company-plan-label"
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
              <FormControl fullWidth margin="normal" size="small" disabled={!formData.plan_id}>
                <InputLabel id="dashboard-payment-status-label">Payment Status</InputLabel>
                <Select
                  labelId="dashboard-payment-status-label"
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
              <FormControl fullWidth margin="normal" size="small" disabled={!formData.plan_id}>
                <InputLabel id="dashboard-billing-cycle-label">Billing Cycle</InputLabel>
                <Select
                  labelId="dashboard-billing-cycle-label"
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
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); setFormData(getInitialCompanyFormData()); }}>Cancel</Button>
          <Button onClick={handleCreateCompany} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={openPlanDialog} onClose={() => { setOpenPlanDialog(false); setEditingPlan(null); }} maxWidth="md" fullWidth>
        <DialogTitle>{editingPlan ? 'Edit' : 'Create'} Subscription Plan</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Plan Name"
            value={planData.name}
            onChange={(e) => setPlanData({ ...planData, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            value={planData.description}
            onChange={(e) => setPlanData({ ...planData, description: e.target.value })}
            margin="normal"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Monthly Price"
                type="number"
                value={planData.price_monthly}
                onChange={(e) => setPlanData({ ...planData, price_monthly: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Yearly Price"
                type="number"
                value={planData.price_yearly}
                onChange={(e) => setPlanData({ ...planData, price_yearly: e.target.value })}
                margin="normal"
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Employee Limit"
            type="number"
            value={planData.employee_limit}
            onChange={(e) => setPlanData({ ...planData, employee_limit: e.target.value })}
            margin="normal"
          />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Features
          </Typography>
          <Grid container spacing={2}>
            {Object.keys(planData.features).map((feature) => (
              <Grid item xs={6} key={feature}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={planData.features[feature]}
                      onChange={(e) =>
                        setPlanData({
                          ...planData,
                          features: { ...planData.features, [feature]: e.target.checked },
                        })
                      }
                    />
                  }
                  label={feature.charAt(0).toUpperCase() + feature.slice(1)}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenPlanDialog(false); setEditingPlan(null); }}>Cancel</Button>
          <Button onClick={handleCreateOrUpdatePlan} variant="contained">
            {editingPlan ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Subscription Details Dialog */}
      <Dialog open={openSubscriptionDialog} onClose={() => setOpenSubscriptionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Subscription Details</DialogTitle>
        <DialogContent>
          {selectedCompany && (
            <Box sx={{ pt: 2 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography variant="body1" fontWeight={600}>{selectedCompany.company_name}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="caption" color="text.secondary">Plan Name</Typography>
                  <Typography variant="body1" fontWeight={600}>{selectedCompany.plan_name || 'No Plan'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Billing Cycle</Typography>
                  <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                    {selectedCompany.billing_cycle || 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" fontWeight={600}>
                    ₹{selectedCompany.subscription_amount || 0}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Start Date</Typography>
                  <Typography variant="body1">
                    {selectedCompany.start_date ? new Date(selectedCompany.start_date).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">End Date</Typography>
                  <Typography variant="body1">
                    {selectedCompany.end_date ? new Date(selectedCompany.end_date).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Chip
                    label={selectedCompany.subscription_status || 'trial'}
                    size="small"
                    color={selectedCompany.subscription_status === 'active' ? 'success' : 'warning'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
                {selectedCompany.plan_features && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Features</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                      {Object.entries(selectedCompany.plan_features).map(([key, value]) => (
                        value && (
                          <Chip
                            key={key}
                            label={key}
                            size="small"
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
      <DialogActions>
          <Button onClick={() => setOpenSubscriptionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeletePlanDialog} onClose={() => setOpenDeletePlanDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Plan</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Delete {planToDelete?.name ? `"${planToDelete.name}"` : 'this plan'}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenDeletePlanDialog(false); setPlanToDelete(null); }}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeletePlan}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
