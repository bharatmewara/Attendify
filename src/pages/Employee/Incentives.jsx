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

const getIncentiveDetails = (productName) => {
  if (productName === 'Bulk SMS') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for Bulk SMS:</Typography>
        <Typography variant="body2">Rate: 0.08 - 0.14</Typography>
        <Typography variant="body2">Quantity 100K-199K: ₹200</Typography>
        <Typography variant="body2">Quantity 200K-299K: ₹250</Typography>
        <Typography variant="body2">Quantity 300K-399K: ₹300</Typography>
        <Typography variant="body2">Quantity 400K-499K: ₹400</Typography>
        <Typography variant="body2">Quantity 500K-900K: ₹500</Typography>
        <Typography variant="body2">Quantity 1M-1.5M: 2% of price</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp SMS') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp SMS:</Typography>
        <Typography variant="body2">Rate: 0.03 - 0.12</Typography>
        <Typography variant="body2">50K-99K (Rate 0.03-0.04): ₹100</Typography>
        <Typography variant="body2">100K-199K (Rate 0.05-0.06): ₹200; (Rate 0.06-0.12): ₹300</Typography>
        <Typography variant="body2">200K-299K (Rate 0.03-0.04): ₹200; (Rate 0.05-0.06): ₹300; (Rate 0.07-0.12): ₹400</Typography>
        <Typography variant="body2">300K-399K (Rate 0.03-0.04): ₹250; (Rate 0.05-0.06): ₹350; (Rate 0.07-0.12): ₹500</Typography>
        <Typography variant="body2">400K-499K (Rate 0.03-0.04): ₹300; (Rate 0.05-0.06): ₹400; (Rate 0.07-0.12): ₹600</Typography>
        <Typography variant="body2">500K+ (Rate 0.03-0.06): ₹400; (Rate 0.07-0.09): ₹900; (Rate 0.10-0.12): ₹1200</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Setup') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Setup:</Typography>
        <Typography variant="body2">Fixed Incentive: ₹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Recharge') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Recharge:</Typography>
        <Typography variant="body2">Price ≤ ₹5000: ₹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Subscription') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Subscription:</Typography>
        <Typography variant="body2">Fixed Incentive: ₹200</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'RCS Setup') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for RCS Setup:</Typography>
        <Typography variant="body2">Fixed Incentive: ₹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'RCS Recharge') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for RCS Recharge:</Typography>
        <Typography variant="body2">Price ≤ ₹15000: ₹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  }
  return null;
};

const calculateIncentivePreview = (productName, smsQuantity, rate, price, packageType) => {
  let incentive = 0;
  smsQuantity = Number(smsQuantity) || 0;
  rate = Number(rate) || 0;
  price = Number(price) || 0;

  if (productName === 'Bulk SMS') {
    if (rate >= 0.08 && rate <= 0.14) {
      if (smsQuantity >= 100000 && smsQuantity < 200000) incentive = 200;
      else if (smsQuantity >= 200000 && smsQuantity < 300000) incentive = 250;
      else if (smsQuantity >= 300000 && smsQuantity < 400000) incentive = 300;
      else if (smsQuantity >= 400000 && smsQuantity < 500000) incentive = 400;
      else if (smsQuantity >= 500000 && smsQuantity <= 900000) incentive = 500;
    }
    if (smsQuantity >= 1000000 && smsQuantity <= 1500000) {
      incentive += price * 0.02;
    }
  } else if (productName === 'WhatsApp SMS') {
    if (smsQuantity >= 50000 && smsQuantity < 100000 && rate >= 0.03 && rate <= 0.04) incentive = 100;
    else if (smsQuantity >= 100000 && smsQuantity < 200000) {
        if (rate >= 0.05 && rate <= 0.06) incentive = 200;
        else if (rate >= 0.06 && rate <= 0.12) incentive = 300;
    } else if (smsQuantity >= 200000 && smsQuantity < 300000) {
        if (rate >= 0.03 && rate <= 0.04) incentive = 200;
        else if (rate >= 0.05 && rate <= 0.06) incentive = 300;
        else if (rate >= 0.07 && rate <= 0.12) incentive = 400;
    } else if (smsQuantity >= 300000 && smsQuantity < 400000) {
        if (rate >= 0.03 && rate <= 0.04) incentive = 250;
        else if (rate >= 0.05 && rate <= 0.06) incentive = 350;
        else if (rate >= 0.07 && rate <= 0.12) incentive = 500;
    } else if (smsQuantity >= 400000 && smsQuantity < 500000) {
        if (rate >= 0.03 && rate <= 0.04) incentive = 300;
        else if (rate >= 0.05 && rate <= 0.06) incentive = 400;
        else if (rate >= 0.07 && rate <= 0.12) incentive = 600;
    } else if (smsQuantity >= 500000) {
        if (rate >= 0.03 && rate <= 0.06) incentive = 400;
        else if (rate >= 0.07 && rate <= 0.09) incentive = 900;
        else if (rate >= 0.10 && rate <= 0.12) incentive = 1200;
    }
  } else if (productName === 'WhatsApp Meta Setup') {
    incentive = 100;
  } else if (productName === 'WhatsApp Meta Recharge') {
    if (price <= 5000) incentive = 100;
  } else if (productName === 'WhatsApp Meta Subscription') {
    incentive = 200;
  } else if (productName === 'RCS Setup') {
    incentive = 100;
  } else if (productName === 'RCS Recharge') {
    if (price <= 15000) incentive = 100;
  }

  if (packageType === 'renew') {
    incentive /= 2;
  }

  return incentive;
};

export default function EmployeeIncentives() {
  const [requests, setRequests] = useState([]);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [calculatedIncentive, setCalculatedIncentive] = useState(0);

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

  useEffect(() => {
    const incentive = calculateIncentivePreview(
      requestForm.product_name,
      requestForm.sms_quantity,
      requestForm.rate,
      requestForm.price,
      requestForm.package_type
    );
    setCalculatedIncentive(incentive);
  }, [requestForm.product_name, requestForm.sms_quantity, requestForm.rate, requestForm.price, requestForm.package_type]);

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
          
          {getIncentiveDetails(requestForm.product_name)}
          
          {['Bulk SMS', 'WhatsApp SMS'].includes(requestForm.product_name) && (
            <>
              <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={requestForm.sms_quantity} onChange={(e) => setRequestForm({ ...requestForm, sms_quantity: e.target.value })} />
              <TextField fullWidth label="Rate" type="number" margin="normal" value={requestForm.rate} onChange={(e) => setRequestForm({ ...requestForm, rate: e.target.value })} />
            </>
          )}

          <TextField fullWidth label="Price" type="number" margin="normal" value={requestForm.price} onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })} />
          
          {calculatedIncentive > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} color="success.contrastText">
                Estimated Incentive: ₹{calculatedIncentive.toFixed(2)}
              </Typography>
            </Box>
          )}
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
