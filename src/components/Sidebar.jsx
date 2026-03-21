import { Avatar, Box, Drawer, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

const drawerWidth = 274;

const Sidebar = ({ mobileOpen, onClose, companyProfile }) => {
  const location = useLocation();
  const { user } = useAuth();

  const getNavItems = () => {
    if (user?.role === 'super_admin') {
      return [
        { label: 'Dashboard', to: '/app/dashboard' },
        { label: 'Companies', to: '/app/companies' },
        { label: 'Plans', to: '/app/plans' },
        { label: 'Analytics', to: '/app/analytics' },
      ];
    }
    if (user?.role === 'company_admin') {
      return [
        { label: 'Dashboard', to: '/app/dashboard' },
        { label: 'Employees', to: '/app/employees' },
        { label: 'Attendance', to: '/app/attendance' },
        { label: 'Attendance ER', to: '/app/attendance-er' },
        { label: 'Leave', to: '/app/leave' },
        { label: 'Shifts', to: '/app/shifts' },
        { label: 'Holidays', to: '/app/holidays' },
        { label: 'Incentives', to: '/app/incentives' },
        { label: 'Payroll', to: '/app/payroll' },
        { label: 'Documents', to: '/app/documents' },
      ];
    }
    if (user?.role === 'employee') {
      return [
        { label: 'Dashboard', to: '/app/dashboard' },
        { label: 'My Attendance', to: '/app/attendance' },
        { label: 'My ER Requests', to: '/app/attendance-er' },
        { label: 'My Leave', to: '/app/leave' },
        { label: 'My Incentives', to: '/app/incentives' },
        { label: 'My Documents', to: '/app/documents' },
      ];
    }
    return [];
  };

  const navItems = getNavItems();
  const logoSrc = companyProfile?.logo
    ? companyProfile.logo.startsWith('http')
      ? companyProfile.logo
      : `${API_BASE_URL.replace(/\/api$/, '')}${companyProfile.logo}`
    : '';
  const brandName = user?.role === 'super_admin' ? 'Attendify Pro' : (companyProfile?.company_name || user?.company_name || 'Company Workspace');
  const subLabel = user?.role === 'super_admin'
    ? 'Super Admin'
    : user?.role === 'company_admin'
      ? 'Company Admin'
      : 'Employee Portal';

  const content = (
    <Box sx={{ p: 2, height: '100%', bgcolor: '#0F172A', color: '#E2E8F0' }}>
      <Stack spacing={0.5} mb={2}>
        {logoSrc ? <Avatar src={logoSrc} variant="rounded" sx={{ width: 56, height: 56, mb: 0.5 }} /> : null}
        <Typography fontWeight={800}>{brandName}</Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          {subLabel}
        </Typography>
      </Stack>
      <List>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <ListItemButton
              key={item.to}
              component={Link}
              to={item.to}
              onClick={onClose}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: isActive ? '#F8FAFC' : '#CBD5E1',
                bgcolor: isActive ? 'rgba(56,189,248,0.24)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(148,163,184,0.18)' },
              }}
            >
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          width: { xs: 0, md: drawerWidth },
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            borderRight: 0,
          },
        }}
        open
      >
        {content}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth, borderRight: 0 },
        }}
      >
        {content}
      </Drawer>
    </>
  );
};

export default Sidebar;
