import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Business,
  People,
  AttachMoney,
  TrendingUp,
  Assessment,
  Timeline,
  PieChart,
  BarChart,
  Warning,
  Schedule,
  CheckCircle,
  Error,
  Notifications,
} from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsData, companiesData, expiringData, paymentsData] = await Promise.all([
        apiRequest('/superadmin/analytics'),
        apiRequest('/superadmin/companies'),
        apiRequest('/superadmin/expiring-subscriptions').catch(() => []),
        apiRequest('/superadmin/pending-payments').catch(() => []),
      ]);
      setAnalytics(analyticsData);
      setCompanies(companiesData);
      setExpiringSubscriptions(expiringData);
      setPendingPayments(paymentsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Companies',
      value: analytics?.total_companies || 0,
      change: '+12%',
      icon: <Business sx={{ fontSize: 32 }} />,
      color: '#667eea',
      bgColor: 'rgba(102, 126, 234, 0.1)',
    },
    {
      title: 'Active Companies',
      value: analytics?.active_companies || 0,
      change: '+8%',
      icon: <Assessment sx={{ fontSize: 32 }} />,
      color: '#f093fb',
      bgColor: 'rgba(240, 147, 251, 0.1)',
    },
    {
      title: 'Total Employees',
      value: analytics?.total_employees || 0,
      change: '+25%',
      icon: <People sx={{ fontSize: 32 }} />,
      color: '#4facfe',
      bgColor: 'rgba(79, 172, 254, 0.1)',
    },
    {
      title: 'Monthly Revenue',
      value: `₹${analytics?.monthly_revenue || 0}`,
      change: '+18%',
      icon: <AttachMoney sx={{ fontSize: 32 }} />,
      color: '#43e97b',
      bgColor: 'rgba(67, 233, 123, 0.1)',
    },
  ];

  const subscriptionStats = companies.reduce((acc, company) => {
    acc[company.subscription_status] = (acc[company.subscription_status] || 0) + 1;
    return acc;
  }, {});

  const topCompanies = companies
    .sort((a, b) => (b.employee_count || 0) - (a.employee_count || 0))
    .slice(0, 5);

  const getDaysColor = (days) => {
    if (days <= 7) return 'error';
    if (days <= 15) return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4">Loading analytics...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          Platform Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time insights and performance metrics
        </Typography>
      </Box>

      {/* Alert Section */}
      {(expiringSubscriptions.length > 0 || pendingPayments.length > 0) && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {expiringSubscriptions.length > 0 && (
            <Grid item xs={12} md={6}>
              <Alert 
                severity="warning" 
                icon={<Schedule />}
                sx={{ borderRadius: 2 }}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  {expiringSubscriptions.length} subscription(s) expiring soon
                </Typography>
              </Alert>
            </Grid>
          )}
          {pendingPayments.length > 0 && (
            <Grid item xs={12} md={6}>
              <Alert 
                severity="error" 
                icon={<Warning />}
                sx={{ borderRadius: 2 }}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  {pendingPayments.length} pending payment(s) require attention
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid',
                borderColor: 'grey.100',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  transition: 'transform 0.3s ease',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                      {stat.value}
                    </Typography>
                    <Chip
                      label={stat.change}
                      size="small"
                      sx={{
                        bgcolor: 'success.50',
                        color: 'success.700',
                        borderRadius: 2,
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: stat.bgColor,
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Expiring Subscriptions */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Schedule sx={{ color: 'warning.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Expiring Subscriptions (Next 30 Days)
                </Typography>
                <Chip 
                  label={expiringSubscriptions.length} 
                  size="small" 
                  color="warning"
                  sx={{ borderRadius: 2 }}
                />
              </Stack>
              
              {expiringSubscriptions.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Plan</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>End Date</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Days Left</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expiringSubscriptions.map((sub) => (
                        <TableRow key={sub.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {sub.company_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {sub.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={sub.plan_name} size="small" color="primary" />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(sub.end_date).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={`${Math.floor(sub.days_remaining)} days`}
                              size="small"
                              color={getDaysColor(sub.days_remaining)}
                              sx={{ borderRadius: 2 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Send Reminder">
                              <IconButton size="small" color="primary">
                                <Notifications fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No subscriptions expiring in the next 30 days
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Subscription Distribution */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Timeline sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Subscription Status
                </Typography>
              </Stack>
              
              <Grid container spacing={2}>
                {Object.entries(subscriptionStats).map(([status, count]) => (
                  <Grid item xs={12} key={status}>
                    <Paper
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                        {status}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        {count}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Pending Payments */}
        <Grid item xs={12}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Error sx={{ color: 'error.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Pending Payments
                </Typography>
                <Chip 
                  label={pendingPayments.length} 
                  size="small" 
                  color="error"
                  sx={{ borderRadius: 2 }}
                />
              </Stack>
              
              {pendingPayments.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Billing Cycle</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingPayments.map((payment) => (
                        <TableRow key={payment.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {payment.company_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {payment.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body1" fontWeight={600}>
                              ₹{payment.amount}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={payment.billing_cycle} 
                              size="small" 
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(payment.due_date).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={payment.days_overdue > 0 ? 'Overdue' : 'Due Soon'}
                              size="small"
                              color={payment.days_overdue > 0 ? 'error' : 'warning'}
                              sx={{ borderRadius: 2 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Send Payment Reminder">
                              <IconButton size="small" color="error">
                                <Notifications fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    All payments are up to date
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top Companies */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <BarChart sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Top Companies by Employees
                </Typography>
              </Stack>
              
              <Stack spacing={2}>
                {topCompanies.map((company, index) => (
                  <Box key={company.id}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip 
                          label={index + 1} 
                          size="small" 
                          sx={{ 
                            width: 28, 
                            height: 28,
                            bgcolor: 'primary.main',
                            color: 'white',
                            fontWeight: 700
                          }} 
                        />
                        <Typography variant="body2" fontWeight={600}>
                          {company.company_name}
                        </Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {company.employee_count || 0} employees
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={((company.employee_count || 0) / Math.max(...companies.map(c => c.employee_count || 0))) * 100}
                      sx={{
                        height: 8,
                        borderRadius: 3,
                        bgcolor: 'grey.100',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          background: `linear-gradient(135deg, #667eea ${index * 20}%, #764ba2 100%)`,
                        },
                      }}
                    />
                    {index < topCompanies.length - 1 && <Divider sx={{ mt: 2 }} />}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Platform Health */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <PieChart sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={600}>
                  Platform Health Metrics
                </Typography>
              </Stack>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'success.50', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color="success.700">
                      99.9%
                    </Typography>
                    <Typography variant="body2" color="success.600">
                      Uptime
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'info.50', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color="info.700">
                      1.2s
                    </Typography>
                    <Typography variant="body2" color="info.600">
                      Response Time
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'warning.50', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color="warning.700">
                      {analytics?.active_users || 0}
                    </Typography>
                    <Typography variant="body2" color="warning.600">
                      Active Users (30d)
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: 'error.50', textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} color="error.700">
                      0
                    </Typography>
                    <Typography variant="body2" color="error.600">
                      Critical Issues
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
