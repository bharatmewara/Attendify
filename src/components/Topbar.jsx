import { AppBar, Avatar, Badge, Box, Button, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ title, subtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/auth/login');
  };

  const displayName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'User';

  const originalSuperAdminId = user?.originalSuperAdminId;

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
          <IconButton color="inherit">
            <Badge color="error" variant="dot">
              <NotificationsNoneRoundedIcon />
            </Badge>
          </IconButton>
          <Avatar sx={{ bgcolor: 'primary.main' }}>{displayName.charAt(0).toUpperCase()}</Avatar>
          {user?.isImpersonated && originalSuperAdminId && (
            <Button 
              size="small" 
              variant="contained" 
              color="secondary" 
              onClick={async () => {
                try {
const superAdminData = await apiRequest('/superadmin/impersonate-exit', { token: localStorage.getItem('attendify_token') });
                  localStorage.setItem(TOKEN_KEY, superAdminData.token);
                  window.location.reload();
                } catch {
                  logout();
                }
              }}
              sx={{ minWidth: 120 }}
            >
              Back to Super
            </Button>
          )}
          <Button size="small" variant="outlined" onClick={onLogout}>
            Logout
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
