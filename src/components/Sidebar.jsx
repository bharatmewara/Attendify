import { Box, Drawer, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 274;

const Sidebar = ({ mobileOpen, onClose }) => {
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
    } else if (user?.role === 'company_admin') {
      return [
        { label: 'Dashboard', to: '/app/dashboard' },
        { label: 'Employees', to: '/app/employees' },
        { label: 'Attendance', to: '/app/attendance' },
        { label: 'Leave', to: '/app/leave' },
        { label: 'Shifts', to: '/app/shifts' },
        { label: 'Payroll', to: '/app/payroll' },
        { label: 'Documents', to: '/app/documents' },
      ];
    } else if (user?.role === 'employee') {
      return [
        { label: 'Dashboard', to: '/app/dashboard' },
        { label: 'My Attendance', to: '/app/attendance' },
        { label: 'My Leave', to: '/app/leave' },
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  const content = (
    <Box sx={{ p: 2, height: '100%', bgcolor: '#0F172A', color: '#E2E8F0' }}>
      <Stack spacing={0.5} mb={2}>
        <Typography fontWeight={800}>Attendify Pro</Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'company_admin' ? 'Company Admin' : 'Employee Portal'}
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