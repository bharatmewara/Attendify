import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Stack,
  Divider,
  IconButton,
  Paper,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Star,
  Check,
  Edit,
  Delete,
  Close,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

export default function PlansPage() {
  const [plans, setPlans] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    employee_limit: '',
    is_active: true,
    features: {
      attendance: true,
      leave: true,
      payroll: false,
      documents: false,
      reports: false,
      api_access: false,
      priority_support: false,
      custom_fields: false,
      advanced_analytics: false,
      mobile_app: false,
    },
  });

  async function loadData() {
    try {
      const data = await apiRequest('/superadmin/subscription-plans');
      setPlans(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrUpdate = async () => {
    try {
      if (editingPlan) {
        await apiRequest(`/superadmin/subscription-plans/${editingPlan.id}`, {
          method: 'PUT',
          body: formData,
        });
        setMessage('Plan updated successfully');
      } else {
        await apiRequest('/superadmin/subscription-plans', {
          method: 'POST',
          body: formData,
        });
        setMessage('Plan created successfully');
      }
      setOpenDialog(false);
      setEditingPlan(null);
      resetForm();
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      employee_limit: plan.employee_limit,
      is_active: plan.is_active,
      features: plan.features || {
        attendance: true,
        leave: true,
        payroll: false,
        documents: false,
        reports: false,
        api_access: false,
        priority_support: false,
        custom_fields: false,
        advanced_analytics: false,
        mobile_app: false,
      },
    });
    setOpenDialog(true);
  };

  const handleOpenDelete = (plan) => {
    setPlanToDelete(plan);
    setOpenDeleteDialog(true);
  };

  const handleDelete = async () => {
    try {
      await apiRequest(`/superadmin/subscription-plans/${planToDelete.id}`, {
        method: 'DELETE',
      });
      setOpenDeleteDialog(false);
      setPlanToDelete(null);
      setMessage('Plan deleted successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price_monthly: '',
      price_yearly: '',
      employee_limit: '',
      is_active: true,
      features: {
        attendance: true,
        leave: true,
        payroll: false,
        documents: false,
        reports: false,
        api_access: false,
        priority_support: false,
        custom_fields: false,
        advanced_analytics: false,
        mobile_app: false,
      },
    });
  };

  const getPlanColor = (index) => {
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    ];
    return colors[index % colors.length];
  };

  const calculateSavings = (monthly, yearly) => {
    if (!monthly || !yearly) return 0;
    return Math.round((1 - (yearly / (monthly * 12))) * 100);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
            Subscription Plans
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage pricing and features for your SaaS platform
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingPlan(null);
            resetForm();
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
          Create Plan
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

      <Grid spacing={3}>
        {plans.map((plan, index) => (
          <Grid xs={12} md={4} key={plan.id}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                position: 'relative',
                overflow: 'visible',
                height: '100%',
                border: plan.is_active ? '2px solid' : '1px solid',
                borderColor: plan.is_active ? 'primary.main' : 'grey.200',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              {index === 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -12,
                    right: 20,
                    background: getPlanColor(index),
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderRadius: 2,
                    boxShadow: 2,
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Star sx={{ fontSize: 16 }} />
                    <Typography variant="caption" fontWeight={700}>
                      POPULAR
                    </Typography>
                  </Stack>
                </Box>
              )}
              
              <CardContent sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                      {plan.name}
                    </Typography>
                    <IconButton 
                      size="small" 
                      onClick={() => handleEdit(plan)}
                      sx={{ 
                        bgcolor: 'primary.50',
                        '&:hover': { bgcolor: 'primary.100' }
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleOpenDelete(plan)}
                      sx={{
                        ml: 0.5,
                        bgcolor: 'error.50',
                        '&:hover': { bgcolor: 'error.100' }
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                    {plan.description}
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography variant="h3" fontWeight={800} sx={{ 
                        background: getPlanColor(index),
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>
                        ₹{plan.price_monthly}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        /month
                      </Typography>
                    </Stack>
<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        ₹{plan.price_yearly}/year
                      </Typography>
                      {calculateSavings(plan.price_monthly, plan.price_yearly) > 0 && (
                        <Chip 
                          label={`Save ${calculateSavings(plan.price_monthly, plan.price_yearly)}%`}
                          size="small"
                          color="success"
                          sx={{ height: 20 }}
                        />
                      )}
                    </Box>
                  </Box>

                  <Chip
                    label={`Up to ${plan.employee_limit} employees`}
                    size="small"
                    sx={{ 
                      bgcolor: 'primary.50', 
                      color: 'primary.700',
                      borderRadius: 2,
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    Features included:
                  </Typography>
                  <Stack spacing={1.5}>
                    {Object.entries(plan.features || {}).map(([feature, enabled]) => (
                      <Stack 
                        key={feature} 
                        direction="row" 
                        alignItems="center" 
                        spacing={1}
                        sx={{ 
                          opacity: enabled ? 1 : 0.4,
                          textDecoration: enabled ? 'none' : 'line-through'
                        }}
                      >
                        {enabled ? (
                          <Check sx={{ fontSize: 18, color: 'success.main' }} />
                        ) : (
                          <Close sx={{ fontSize: 18, color: 'error.main' }} />
                        )}
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {feature.replace(/_/g, ' ')}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'grey.100' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip
                      label={plan.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={plan.is_active ? 'success' : 'default'}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ID: {plan.id}
                    </Typography>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); setEditingPlan(null); }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="div" fontWeight={600}>
            {editingPlan ? 'Edit' : 'Create'} Subscription Plan
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid spacing={3} sx={{ mt: 1 }}>
            <Grid xs={12} sm={8}>
              <TextField
                fullWidth
                label="Plan Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid xs={12} sm={4}>
              <TextField
                fullWidth
                label="Employee Limit"
                type="number"
                value={formData.employee_limit}
                onChange={(e) => setFormData({ ...formData, employee_limit: e.target.value })}
                required
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the plan"
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monthly Price (₹)"
                type="number"
                value={formData.price_monthly}
                onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value })}
                required
              />
            </Grid>
            <Grid xs={12} sm={6}>
              <TextField
                fullWidth
                label="Yearly Price (₹)"
                type="number"
                value={formData.price_yearly}
                onChange={(e) => setFormData({ ...formData, price_yearly: e.target.value })}
                required
                helperText={`Savings: ${calculateSavings(formData.price_monthly, formData.price_yearly)}%`}
              />
            </Grid>
            <Grid xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                }
                label="Active Plan"
              />
            </Grid>
            <Grid xs={12}>
              <Divider />
            </Grid>
            <Grid xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Features & Modules
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Grid spacing={2}>
                  {Object.keys(formData.features).map((feature) => (
                    <Grid xs={12} sm={6} key={feature}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.features[feature]}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                features: { ...formData.features, [feature]: e.target.checked },
                              })
                            }
                            color="primary"
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {feature.replace(/_/g, ' ')}
                          </Typography>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setOpenDialog(false); setEditingPlan(null); }} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateOrUpdate} 
            variant="contained"
            sx={{ 
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {editingPlan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Subscription Plan</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ pt: 1 }}>
            Delete {planToDelete?.name ? `"${planToDelete.name}"` : 'this plan'}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setOpenDeleteDialog(false); setPlanToDelete(null); }}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
