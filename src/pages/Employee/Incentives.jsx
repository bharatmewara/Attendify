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
import { Add, UploadFile } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const requestInitial = {
  client_name: '',
  product_name: 'Bulk SMS',
  sms_quantity: '',
  rate: '',
  price: '',
  payment_mode: '',
  package_type: 'new',
  client_location: '',
  screenshot: null,
};

const productOptions = [
  'Bulk SMS',
  'WhatsApp SMS',
  'WhatsApp Meta Setup',
  'WhatsApp Meta Recharge',
  'WhatsApp Meta Subscription',
  'RCS Setup',
  'RCS Recharge',
];

export default function EmployeeIncentives() {
  const [requests, setRequests] = useState([]);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const req = await apiRequest('/incentives/submissions');
      setRequests(req || []);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFileChange = (e) => {
    setRequestForm({ ...requestForm, screenshot: e.target.files[0] });
  };

  const handleSubmit = async () => {
    const formData = new FormData();
    Object.keys(requestForm).forEach(key => {
      if (key === 'screenshot' && requestForm.screenshot) {
        formData.append('screenshot', requestForm.screenshot);
      } else if (requestForm[key]) {
        formData.append(key, requestForm[key]);
      }
    });

    try {
      await apiRequest('/incentives/submissions', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set Content-Type for FormData
      });
      setOpenRequestDialog(false);
      setRequestForm(requestInitial);
      setMessage({ type: 'success', text: 'Incentive request submitted for approval.' });
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
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={800}>My Incentives</Typography>
                <Typography color="text.secondary">Submit incentive sales requests and track approval status.</Typography>
              </Box>
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenRequestDialog(true)}>
                Submit Incentive Request
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>My Submissions</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Incentive</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Submitted At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.client_name}</TableCell>
                      <TableCell>{row.product_name}</TableCell>
                      <TableCell>{Number(row.price).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentive_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status}
                          color={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>{new Date(row.submitted_at).toLocaleString()}</TableCell>
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
          <TextField fullWidth label="Client Name" margin="normal" value={requestForm.client_name} onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })} />
          <TextField fullWidth select label="Product Name" margin="normal" value={requestForm.product_name} onChange={(e) => setRequestForm({ ...requestForm, product_name: e.target.value })}>
            {productOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>
          
          {['Bulk SMS', 'WhatsApp SMS'].includes(requestForm.product_name) && (
            <>
              <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={requestForm.sms_quantity} onChange={(e) => setRequestForm({ ...requestForm, sms_quantity: e.target.value })} />
              <TextField fullWidth label="Rate" type="number" margin="normal" value={requestForm.rate} onChange={(e) => setRequestForm({ ...requestForm, rate: e.target.value })} />
            </>
          )}

          <TextField fullWidth label="Price" type="number" margin="normal" value={requestForm.price} onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })} />
          <TextField fullWidth label="Payment Mode" margin="normal" value={requestForm.payment_mode} onChange={(e) => setRequestForm({ ...requestForm, payment_mode: e.target.value })} />
          <TextField fullWidth select label="Client Package Type" margin="normal" value={requestForm.package_type} onChange={(e) => setRequestForm({ ...requestForm, package_type: e.target.value })}>
            <MenuItem value="new">New</MenuItem>
            <MenuItem value="renew">Renew</MenuItem>
          </TextField>
          <TextField fullWidth label="Client Location" margin="normal" value={requestForm.client_location} onChange={(e) => setRequestForm({ ...requestForm, client_location: e.target.value })} />
          
          <Button component="label" variant="outlined" startIcon={<UploadFile />} sx={{ mt: 1 }}>
            Upload Screenshot
            <input type="file" hidden onChange={handleFileChange} />
          </Button>
          {requestForm.screenshot && <Typography variant="body2" sx={{ mt: 1 }}>{requestForm.screenshot.name}</Typography>}

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequestDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
