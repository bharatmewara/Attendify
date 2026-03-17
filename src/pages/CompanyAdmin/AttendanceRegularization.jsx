import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { Add, Check, Close } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function AttendanceRegularization() {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [requests, setRequests] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    work_date: '',
    punch_in_time: '',
    punch_out_time: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await apiRequest('/attendance/regularization-requests');
      setRequests(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSubmitRequest = async () => {
    if (!formData.work_date || !formData.reason) {
      setMessage('Please fill all required fields');
      return;
    }

    try {
      await apiRequest('/attendance/regularization-requests', {
        method: 'POST',
        body: formData,
      });
      setOpenDialog(false);
      setFormData({
        work_date: '',
        punch_in_time: '',
        punch_out_time: '',
        reason: '',
      });
      setMessage('Regularization request submitted successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleApproveReject = async (id, status, rejectionReason = null) => {
    try {
      await apiRequest(`/attendance/regularization-requests/${id}`, {
        method: 'PUT',
        body: { status, rejection_reason: rejectionReason },
      });
      setMessage(`Request ${status} successfully`);
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleReject = (id) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      handleApproveReject(id, 'rejected', reason);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Attendance Regularization
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Request attendance corrections for missed punch-in/out
          </Typography>
        </Box>
        {user.role === 'employee' && (
          <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => setOpenDialog(true)}
            sx={{ borderRadius: 2 }}
          >
            Raise Request
          </Button>
        )}
      </Box>

      {message && (
        <Alert 
          severity={message.includes('success') ? 'success' : 'error'} 
          sx={{ mb: 2 }} 
          onClose={() => setMessage('')}
        >
          {message}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
            <Tab label={`Pending (${pendingRequests.length})`} />
            <Tab label={`Approved (${approvedRequests.length})`} />
            <Tab label={`Rejected (${rejectedRequests.length})`} />
          </Tabs>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  {user.role !== 'employee' && <TableCell sx={{ fontWeight: 600 }}>Employee</TableCell>}
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Punch In</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Punch Out</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  {tabValue === 2 && <TableCell sx={{ fontWeight: 600 }}>Rejection Reason</TableCell>}
                  {user.role === 'company_admin' && tabValue === 0 && (
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {(tabValue === 0
                  ? pendingRequests
                  : tabValue === 1
                  ? approvedRequests
                  : rejectedRequests
                ).map((request) => (
                  <TableRow key={request.id} sx={{ '&:hover': { bgcolor: 'grey.50' } }}>
                    {user.role !== 'employee' && (
                      <TableCell>{`${request.first_name} ${request.last_name}`}</TableCell>
                    )}
                    <TableCell>{new Date(request.work_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {request.punch_in_time 
                        ? new Date(`2000-01-01T${request.punch_in_time}`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : 'Not specified'}
                    </TableCell>
                    <TableCell>
                      {request.punch_out_time 
                        ? new Date(`2000-01-01T${request.punch_out_time}`).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : 'Not specified'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300 }}>
                        {request.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        size="small"
                        color={
                          request.status === 'approved'
                            ? 'success'
                            : request.status === 'rejected'
                            ? 'error'
                            : 'warning'
                        }
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    {tabValue === 2 && (
                      <TableCell>
                        <Typography variant="body2" color="error">
                          {request.rejection_reason || '-'}
                        </Typography>
                      </TableCell>
                    )}
                    {user.role === 'company_admin' && tabValue === 0 && (
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Check />}
                          color="success"
                          onClick={() => handleApproveReject(request.id, 'approved')}
                          sx={{ mr: 1 }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Close />}
                          color="error"
                          onClick={() => handleReject(request.id)}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {(tabValue === 0 ? pendingRequests : tabValue === 1 ? approvedRequests : rejectedRequests).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={user.role === 'employee' ? 6 : 7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No {tabValue === 0 ? 'pending' : tabValue === 1 ? 'approved' : 'rejected'} requests
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Raise Request Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Raise Attendance Regularization Request
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Submit a request to regularize your attendance for a missed punch-in or punch-out
              </Alert>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Date *"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.work_date}
                onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                required
                inputProps={{
                  max: new Date().toISOString().split('T')[0],
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Punch In Time"
                type="time"
                InputLabelProps={{ shrink: true }}
                value={formData.punch_in_time}
                onChange={(e) => setFormData({ ...formData, punch_in_time: e.target.value })}
                helperText="Leave empty if not applicable"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Punch Out Time"
                type="time"
                InputLabelProps={{ shrink: true }}
                value={formData.punch_out_time}
                onChange={(e) => setFormData({ ...formData, punch_out_time: e.target.value })}
                helperText="Leave empty if not applicable"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Reason *"
                multiline
                rows={4}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                placeholder="Explain why you need attendance regularization..."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmitRequest} variant="contained">
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
