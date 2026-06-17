import { Avatar, Box, Collapse, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  Dashboard,
  Business,
  BarChart,
  People,
  CheckCircle,
  Edit,
  EventNote,
  AccessTime,
  Celebration,
  MonetizationOn,
  Person,
  AccountBalanceWallet,
  Description,
  Settings,
  ExpandLess,
  ExpandMore,
  Tune,
  AccountTree,
  Group,
  PlayCircle,
  History,
  Receipt,
  Security,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../lib/api';

const drawerWidth = 274;

const PAYROLL_CHILDREN = [
  { label: 'Overview',         to: '/app/payroll',              icon: AccountBalanceWallet },
  { label: 'Settings',         to: '/app/payroll/settings',     icon: Tune },
  { label: 'Components',       to: '/app/payroll/components',   icon: AccountTree },
  { label: 'Structures',       to: '/app/payroll/templates',    icon: AccountTree },
  { label: 'Assignments',      to: '/app/payroll/assignments',  icon: Group },
  { label: 'Run Payroll',      to: '/app/payroll',              icon: PlayCircle, runOnly: true },
  { label: 'History',          to: '/app/payroll/history',      icon: History },
  { label: 'Audit Log',        to: '/app/payroll/audit',        icon: Security },
];

const Sidebar = ({ mobileOpen, onClose, companyProfile }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [payrollOpen, setPayrollOpen] = useState(
    location.pathname.startsWith('/app/payroll')
  );

  const getNavItems = () => {
    if (user?.role === 'super_admin') {
      return [
        { label: 'Dashboard', to: '/app/dashboard', icon: Dashboard },
        { label: 'Companies', to: '/app/companies', icon: Business },
        { label: 'Plans', to: '/app/plans', icon: BarChart },
        { label: 'Analytics', to: '/app/analytics', icon: BarChart },
        { label: 'Admin Settings', to: '/app/settings', icon: Settings },
      ];
    }
    if (user?.role === 'company_admin' || user?.role === 'hr_manager') {
      return [
        { label: 'Dashboard',     to: '/app/dashboard',    icon: Dashboard },
        { label: 'Employees',     to: '/app/employees',    icon: People },
        { label: 'Attendance',    to: '/app/attendance',   icon: CheckCircle },
        { label: 'Attendance ER', to: '/app/attendance-er',icon: Edit },
        { label: 'Leave',         to: '/app/leave',        icon: EventNote },
        { label: 'Shifts',        to: '/app/shifts',       icon: AccessTime },
        { label: 'Holidays',      to: '/app/holidays',     icon: Celebration },
        { label: 'Incentives',    to: '/app/incentives',   icon: MonetizationOn },
        { label: 'Clients',       to: '/app/clients',      icon: Person },
        { label: 'Payroll',       to: '/app/payroll',      icon: AccountBalanceWallet, hasChildren: true },
        { label: 'Documents',     to: '/app/documents',    icon: Description },
      ];
    }
    if (user?.role === 'employee') {
      return [
        { label: 'Dashboard',      to: '/app/dashboard',    icon: Dashboard },
        { label: 'My Attendance',  to: '/app/attendance',   icon: CheckCircle },
        { label: 'My ER Requests', to: '/app/attendance-er',icon: Edit },
        { label: 'My Leave',       to: '/app/leave',        icon: EventNote },
        { label: 'My Performance', to: '/app/performance',  icon: BarChart },
        { label: 'Today Status',   to: '/app/incentives',   icon: MonetizationOn },
        { label: 'My Clients',     to: '/app/my-clients',   icon: Person },
        { label: 'My Payslips',    to: '/app/payroll',      icon: Receipt },
        { label: 'My Documents',   to: '/app/documents',    icon: Description },
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
    <Box sx={{ height: '100%', bgcolor: '#0F172A', color: '#E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <Stack spacing={0.5} sx={{ p: 2, pb: 1, flexShrink: 0 }}>
{logoSrc ? <Avatar src={logoSrc} variant="rounded" sx={{ width: 56, height: 56, mb: 0.5, bgcolor: 'white', borderRadius: 1 }} /> : null}
        <Typography fontWeight={800}>{brandName}</Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          {subLabel}
        </Typography>
      </Stack>
      <List sx={{ width: '100%', bgcolor: 'transparent', overflow: 'visible', flex: 1, p: 2, pt: 1 }}>
        {navItems.map((item) => {
          const isPayrollParent = item.hasChildren && location.pathname.startsWith('/app/payroll');
          const isActive = !item.hasChildren && (
            location.pathname === item.to ||
            (item.to !== '/app/attendance' && item.to !== '/app/payroll' && location.pathname.startsWith(item.to))
          );
          const IconComponent = item.icon;
          const itemColor = (isActive || isPayrollParent) ? '#F8FAFC' : '#CBD5E1';

          if (item.hasChildren) {
            return (
              <Box key={item.to}>
                <ListItemButton
                  onClick={() => setPayrollOpen(p => !p)}
                  sx={{
                    borderRadius: 2, mb: 0.5,
                    backgroundColor: isPayrollParent ? 'rgba(56,189,248,0.24) !important' : 'transparent !important',
                    '&:hover': { backgroundColor: 'rgba(148,163,184,0.18) !important' },
                  }}
                >
                  <ListItemIcon sx={{ color: `${itemColor} !important`, minWidth: 40 }}>
                    <IconComponent fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ sx: { color: `${itemColor} !important`, fontSize: '14px !important', fontWeight: '600 !important' } }}
                  />
                  {payrollOpen ? <ExpandLess sx={{ color: '#94A3B8', fontSize: 18 }} /> : <ExpandMore sx={{ color: '#94A3B8', fontSize: 18 }} />}
                </ListItemButton>
                <Collapse in={payrollOpen} timeout="auto">
                  <List disablePadding sx={{ pl: 2, mb: 0.5 }}>
                    {PAYROLL_CHILDREN.filter(c => !c.runOnly).map(child => {
                      const childActive = child.to === '/app/payroll'
                        ? location.pathname === '/app/payroll'
                        : location.pathname.startsWith(child.to);
                      const ChildIcon = child.icon;
                      const childColor = childActive ? '#F8FAFC' : '#94A3B8';
                      return (
                        <ListItemButton
                          key={child.to + child.label}
                          component={Link}
                          to={child.to}
                          onClick={onClose}
                          sx={{
                            borderRadius: 2, mb: 0.3, py: 0.6,
                            backgroundColor: childActive ? 'rgba(56,189,248,0.18) !important' : 'transparent !important',
                            '&:hover': { backgroundColor: 'rgba(148,163,184,0.12) !important' },
                          }}
                        >
                          <ListItemIcon sx={{ color: `${childColor} !important`, minWidth: 36 }}>
                            <ChildIcon sx={{ fontSize: 16 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={child.label}
                            primaryTypographyProps={{ sx: { color: `${childColor} !important`, fontSize: '13px !important', fontWeight: '500 !important' } }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.to + item.label}
              component={Link}
              to={item.to}
              onClick={onClose}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                backgroundColor: isActive ? 'rgba(56,189,248,0.24) !important' : 'transparent !important',
                '&:hover': { backgroundColor: 'rgba(148,163,184,0.18) !important' },
                '&:active': { backgroundColor: 'transparent !important' },
                '& .MuiListItemIcon-root': { color: `${itemColor} !important`, minWidth: 40 },
                '& .MuiListItemText-primary': { color: `${itemColor} !important`, fontSize: '14px !important', fontWeight: '600 !important' },
              }}
            >
              <ListItemIcon sx={{ color: `${itemColor} !important`, minWidth: 40 }}>
                <IconComponent fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ sx: { color: `${itemColor} !important`, fontSize: '14px !important', fontWeight: '600 !important' } }}
              />
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
