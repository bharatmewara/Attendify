import { AppBar, Avatar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import NotificationBell from './NotificationBell';

const Topbar = ({ title, subtitle, companyProfile }) => {
  const { user, logout, setSessionToken } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/auth/login');
  };

  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'User';

  const handleExitImpersonation = async () => {
    try {
      const data = await apiRequest('/auth/impersonate-exit');
      setSessionToken(data.token);
      navigate('/app/dashboard');
    } catch {
      logout();
      navigate('/auth/login');
    }
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)' }}
    >
      <Toolbar sx={{ minHeight: 68, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
          {companyProfile?.company_name ? (
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {companyProfile.company_name}
            </Typography>
          ) : null}
        </Box>

        <Stack direction="row" spacing={1.25} alignItems="center">
          {user ? (
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {displayName} ({user.role})
              {user.isImpersonated && (
                <Typography component="span" variant="caption" sx={{ ml: 1, bgcolor: 'warning.main', px: 1, py: 0.25, borderRadius: 1, fontWeight: 600 }}>
                  Impersonating
                </Typography>
              )}
            </Typography>
          ) : null}
          {user ? (
            <NotificationBell endpoint={user.role === 'super_admin' ? '/superadmin/notifications' : '/notifications'} />
          ) : null}
          <Avatar sx={{ bgcolor: 'primary.main' }}>{displayName.charAt(0).toUpperCase()}</Avatar>
          
          <Button size="small" variant="outlined" onClick={onLogout}>
            Logout
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
