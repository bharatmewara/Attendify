import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const navItems = [
  { label: 'Login', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const toggleDrawer = () => setMobileOpen((prev) => !prev);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'rgba(255, 255, 255, 0.86)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ minHeight: 72 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)',
              }}
            />
            <Box>
              <Typography fontWeight={800} lineHeight={1.1}>
                Attendify Pro
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Workforce Intelligence Suite
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={Link}
                to={item.to}
                color="inherit"
                sx={{
                  px: 2,
                  borderRadius: 999,
                  bgcolor: location.pathname === item.to ? 'primary.main' : 'transparent',
                  color: location.pathname === item.to ? 'primary.contrastText' : 'text.primary',
                  '&:hover': {
                    bgcolor: location.pathname === item.to ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2 }}>
            <Box sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              <NotificationBell />
            </Box>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', display: { xs: 'none', md: 'flex' } }}>
              SA
            </Avatar>
            <IconButton onClick={toggleDrawer} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </Container>

      <Drawer anchor="right" open={mobileOpen} onClose={toggleDrawer}>
        <Box sx={{ width: 260, pt: 2 }}>
          <Typography sx={{ px: 2, pb: 1 }} fontWeight={700}>
            Navigate
          </Typography>
          <List>
            {navItems.map((item) => (
              <ListItem key={item.to} disablePadding>
                <ListItemButton component={Link} to={item.to} onClick={toggleDrawer}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
};

export default Navbar;
