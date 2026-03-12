import { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Circle,
  ExpandMore,
  FilterList,
  DoneAll,
  Delete,
} from '@mui/icons-material';
import { apiRequest } from '../lib/api';

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await apiRequest('/superadmin/notifications');
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
    setOpenDialog(true);
    handleClose();
  };

  const handleMarkAllRead = async () => {
    try {
      // API call to mark all as read
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      // API call to clear all notifications
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'error.main';
      case 'high': return 'warning.main';
      case 'normal': return 'info.main';
      default: return 'grey.500';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 500,
            borderRadius: 2,
            mt: 1,
          }
        }}
      >
        <Box sx={{ p: 2, pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>
              Notifications
            </Typography>
            <Chip 
              label={unreadCount} 
              size="small" 
              color="error" 
              sx={{ borderRadius: 2 }}
            />
          </Stack>
        </Box>

        <Box sx={{ px: 2, pb: 1 }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(e, value) => value && setFilter(value)}
            size="small"
            fullWidth
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="unread">Unread</ToggleButton>
            <ToggleButton value="read">Read</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Divider />

        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredNotifications.length > 0 ? (
            filteredNotifications.slice(0, 10).map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  py: 1.5,
                  px: 2,
                  bgcolor: notification.is_read ? 'transparent' : 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} width="100%">
                  <Circle 
                    sx={{ 
                      fontSize: 12, 
                      color: getPriorityColor(notification.priority),
                      mt: 0.5
                    }} 
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography 
                      variant="body2" 
                      fontWeight={notification.is_read ? 400 : 600}
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {notification.title}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <Chip
                        label={notification.type}
                        size="small"
                        color={getNotificationColor(notification.type)}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </MenuItem>
            ))
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          )}
        </Box>

        {notifications.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<DoneAll />}
                  onClick={handleMarkAllRead}
                  fullWidth
                >
                  Mark All Read
                </Button>
                <Button
                  size="small"
                  startIcon={<Delete />}
                  onClick={handleClearAll}
                  color="error"
                  fullWidth
                >
                  Clear All
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Menu>

      {/* Full Notification Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" fontWeight={600}>
                {selectedNotification?.title}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip
                  label={selectedNotification?.type}
                  size="small"
                  color={getNotificationColor(selectedNotification?.type)}
                />
                <Chip
                  label={selectedNotification?.priority}
                  size="small"
                  sx={{ 
                    bgcolor: getPriorityColor(selectedNotification?.priority),
                    color: 'white',
                    textTransform: 'capitalize'
                  }}
                />
              </Stack>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {selectedNotification?.message}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {selectedNotification?.company_name && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Company</Typography>
                  <Typography variant="body2">{selectedNotification.company_name}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="caption" color="text.secondary">Sent By</Typography>
                <Typography variant="body2">{selectedNotification?.created_by_name || 'System'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Date & Time</Typography>
                <Typography variant="body2">
                  {selectedNotification?.created_at && new Date(selectedNotification.created_at).toLocaleString()}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
