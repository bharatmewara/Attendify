import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Paper,
  Snackbar,
} from '@mui/material';
import { Add, Delete, Edit, CalendarMonth } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const defaultForm = { name: '', holiday_date: '', description: '' };

const shellCardSx = {
  borderRadius: 3,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HolidayManagement() {
  const [holidays, setHolidays] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const year = new Date().getFullYear();

  const loadHolidays = async () => {
    try {
      const data = await apiRequest(`/holidays?year=${year}`);
      setHolidays(data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => { loadHolidays(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setOpenDialog(true);
  };

  const openEdit = (h) => {
    setEditingId(h.id);
    setForm({ name: h.name, holiday_date: h.holiday_date.split('T')[0], description: h.description || '' });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.holiday_date) {
      setMessage({ type: 'error', text: 'Name and date are required.' });
      return;
    }
    try {
      if (editingId) {
        await apiRequest(`/holidays/${editingId}`, { method: 'PUT', body: form });
        setMessage({ type: 'success', text: 'Holiday updated.' });
      } else {
        await apiRequest('/holidays', { method: 'POST', body: form });
        setMessage({ type: 'success', text: 'Holiday added.' });
      }
      setOpenDialog(false);
      loadHolidays();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/holidays/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Holiday deleted.' });
      setDeleteConfirm(null);
      loadHolidays();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  // Group by month for visual display
  const grouped = {};
  holidays.forEach((h) => {
    const d = new Date(h.holiday_date);
    const m = d.getMonth();
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(h);
  });

  const upcoming = holidays.filter(h => new Date(h.holiday_date) >= new Date()).slice(0, 3);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Holiday Management</Typography>
          <Typography color="text.secondary">Manage company holidays for {year}. Employees will be notified automatically.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}>
          Add Holiday
        </Button>
      </Box>

      <Snackbar 
        open={Boolean(message.text)} 
        autoHideDuration={6000} 
        onClose={() => setMessage({ type: '', text: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity={message.type || 'info'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message.text}
        </Alert>
      </Snackbar>

      {/* Upcoming Holidays Banner */}
      {upcoming.length > 0 && (
        <Card sx={{ ...shellCardSx, mb: 4, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', color: '#fff' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonth /> Upcoming Holidays
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {upcoming.map((h) => {
                const d = new Date(h.holiday_date);
                const daysLeft = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <Paper key={h.id} sx={{ p: 2, borderRadius: 2, minWidth: 160, bgcolor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                      {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#fff' }}>{h.name}</Typography>
                    <Chip size="small" label={daysLeft === 0 ? 'Today!' : `In ${daysLeft} days`} sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.7rem' }} />
                  </Paper>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Holidays Table */}
      <Card sx={{ ...shellCardSx }}>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700}>All Holidays — {year}</Typography>
            <Chip label={`${holidays.length} holidays`} color="primary" variant="outlined" />
          </Box>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Day</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Holiday Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No holidays added yet. Click "Add Holiday" to get started.</Typography>
                    </TableCell>
                  </TableRow>
                ) : holidays.map((h) => {
                  const d = new Date(h.holiday_date);
                  const isPast = d < new Date();
                  const isToday = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
                  return (
                    <TableRow key={h.id} hover sx={{ bgcolor: isToday ? 'rgba(79,70,229,0.04)' : undefined }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: isPast ? 'grey.100' : '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" sx={{ color: isPast ? 'text.secondary' : 'rgba(255,255,255,0.8)', fontSize: '0.6rem', lineHeight: 1 }}>{MONTH_NAMES[d.getMonth()]}</Typography>
                            <Typography variant="subtitle2" sx={{ color: isPast ? 'text.primary' : '#fff', fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{d.toLocaleDateString('en-GB', { weekday: 'long' })}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{h.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{h.description || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={isToday ? 'Today' : isPast ? 'Past' : 'Upcoming'}
                          color={isToday ? 'primary' : isPast ? 'default' : 'success'}
                          variant={isPast ? 'outlined' : 'filled'}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEdit(h)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteConfirm(h)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editingId ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Holiday Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            margin="normal" placeholder="e.g. Republic Day"
          />
          <TextField
            fullWidth label="Date" type="date" InputLabelProps={{ shrink: true }}
            value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth label="Description (optional)" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            margin="normal" multiline rows={2} placeholder="Short description or note"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" sx={{ bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}>
            {editingId ? 'Update Holiday' : 'Add Holiday'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Holiday</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button onClick={() => handleDelete(deleteConfirm?.id)} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
