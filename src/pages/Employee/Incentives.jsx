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
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const requestInitial = {
  incentive_config_id: '',
  payment_type: 'new',
  quantity: 1,
  screenshot_url: '',
  note: '',
};

export default function EmployeeIncentives() {
  const [configs, setConfigs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const [cfg, req] = await Promise.all([
        apiRequest('/incentives/config'),
        apiRequest('/incentives/requests'),
      ]);
      setConfigs(cfg || []);
      setRequests(req || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async () => {
    try {
      await apiRequest('/incentives/requests', { method: 'POST', body: requestForm });
      setOpenRequestDialog(false);
      setRequestForm(requestInitial);
      setMessage({ type: 'success', text: 'Incentive request submitted. Admin can approve from Incentive Management.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {message.text ? <Alert severity={message.type || 'info'}>{message.text}</Alert> : null}

        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={800}>My Incentives</Typography>
                <Typography color="text.secondary">Submit incentive sales requests with payment proof and track approval status.</Typography>
              </Box>
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenRequestDialog(true)}>
                Submit Incentive Request
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>My Requests</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Incentive Type</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Payment Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Requested At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.incentive_type}</TableCell>
                      <TableCell>{Number(row.package_volume).toLocaleString()}</TableCell>
                      <TableCell>{row.payment_type}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status}
                          color={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>{new Date(row.requested_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={openRequestDialog} onClose={() => setOpenRequestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Incentive Request</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Incentive Slab" margin="normal" value={requestForm.incentive_config_id} onChange={(e) => setRequestForm({ ...requestForm, incentive_config_id: e.target.value })}>
            {configs.map((cfg) => (
              <MenuItem key={cfg.id} value={cfg.id}>
                {cfg.incentive_type} - {Number(cfg.package_volume).toLocaleString()} - Incentive {cfg.incentive_amount}
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth select label="Payment Type" margin="normal" value={requestForm.payment_type} onChange={(e) => setRequestForm({ ...requestForm, payment_type: e.target.value })}>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="renew">Renew</MenuItem>
          </TextField>
          <TextField fullWidth label="Quantity" type="number" margin="normal" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: Number(e.target.value) })} />
          <TextField fullWidth label="Payment Screenshot URL" margin="normal" value={requestForm.screenshot_url} onChange={(e) => setRequestForm({ ...requestForm, screenshot_url: e.target.value })} helperText="Paste uploaded screenshot link." />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={3} value={requestForm.note} onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
