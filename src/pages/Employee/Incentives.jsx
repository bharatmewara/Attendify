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
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Edit, UploadFile } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const requestInitial = {
  client_name: '',
  product_name: 'Bulk SMS',
  client_mobile_1: '',
  client_mobile_2: '',
  client_email: '',
  client_username: '',
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
        <Typography variant="body2">Quantity 1Lakh-1.99Lakh: Rs.200</Typography>
        <Typography variant="body2">Quantity 2Lakh-2.99Lakh: Rs.250</Typography>
        <Typography variant="body2">Quantity 3Lakh-3.99Lakh: Rs.300</Typography>
        <Typography variant="body2">Quantity 4Lakh-4.99Lakh: Rs.400</Typography>
        <Typography variant="body2">Quantity 5Lakh-9Lakh: Rs.500</Typography>
        <Typography variant="body2">Quantity 1M-1.5M: 2% of price</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp SMS') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp SMS:</Typography>
        <Typography variant="body2">Rate: 0.03 - 0.12</Typography>
        <Typography variant="body2">50K-99K (Rate 0.03-0.04): â‚¹100</Typography>
        <Typography variant="body2">100K-199K (Rate 0.05-0.06): â‚¹200; (Rate 0.06-0.12): â‚¹300</Typography>
        <Typography variant="body2">200K-299K (Rate 0.03-0.04): â‚¹200; (Rate 0.05-0.06): â‚¹300; (Rate 0.07-0.12): â‚¹400</Typography>
        <Typography variant="body2">300K-399K (Rate 0.03-0.04): â‚¹250; (Rate 0.05-0.06): â‚¹350; (Rate 0.07-0.12): â‚¹500</Typography>
        <Typography variant="body2">400K-499K (Rate 0.03-0.04): â‚¹300; (Rate 0.05-0.06): â‚¹400; (Rate 0.07-0.12): â‚¹600</Typography>
        <Typography variant="body2">500K+ (Rate 0.03-0.06): â‚¹400; (Rate 0.07-0.09): â‚¹900; (Rate 0.10-0.12): â‚¹1200</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Setup') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Setup:</Typography>
        <Typography variant="body2">Fixed Incentive: â‚¹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Recharge') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Recharge:</Typography>
        <Typography variant="body2">Price â‰¤ â‚¹5000: â‚¹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'WhatsApp Meta Subscription') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for WhatsApp Meta Subscription:</Typography>
        <Typography variant="body2">Fixed Incentive: â‚¹200</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'RCS Setup') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for RCS Setup:</Typography>
        <Typography variant="body2">Fixed Incentive: â‚¹100</Typography>
        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>Renewal packages get half incentive.</Typography>
      </Box>
    );
  } else if (productName === 'RCS Recharge') {
    return (
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Incentive Details for RCS Recharge:</Typography>
        <Typography variant="body2">Price â‰¤ â‚¹15000: â‚¹100</Typography>
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
  const [officeOnlyBlocked, setOfficeOnlyBlocked] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editFile, setEditFile] = useState(null);

  const loadData = async () => {
    try {
      const req = await apiRequest('/incentives/submissions');
      setRequests(req || []);
      setOfficeOnlyBlocked(false);
    } catch (error) {
      const msg = String(error?.message || 'Request failed');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setOfficeOnlyBlocked(true);
        setRequests([]);
        setMessage({ type: 'warning', text: 'Incentives are available only from office-approved network.' });
        return;
      }
      setMessage({ type: 'error', text: msg });
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

  const rateInvalid = ['Bulk SMS', 'WhatsApp SMS'].includes(requestForm.product_name)
    && requestForm.rate !== ''
    && Number(requestForm.rate) >= 1;

  const handleFileChange = (e) => {
    setRequestForm({ ...requestForm, screenshot: e.target.files[0] });
  };

  const openEdit = (row) => {
    setEditForm({
      id: row.id,
      client_name: row.client_name || '',
      product_name: row.product_name || 'Bulk SMS',
      client_mobile_1: row.client_mobile_1 || '',
      client_mobile_2: row.client_mobile_2 || '',
      client_email: row.client_email || '',
      client_username: row.client_username || '',
      sms_quantity: row.sms_quantity ?? '',
      rate: row.rate ?? '',
      price: row.price ?? '',
      payment_mode: row.payment_mode || '',
      package_type: row.package_type || 'new',
      client_location: row.client_location || '',
    });
    setEditFile(null);
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditForm(null);
    setEditFile(null);
  };

  const editRateInvalid = editForm
    ? ['Bulk SMS', 'WhatsApp SMS'].includes(editForm.product_name)
      && editForm.rate !== ''
      && Number(editForm.rate) >= 1
    : false;

  const handleEditFileChange = (e) => {
    setEditFile(e.target.files[0] || null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    if (editRateInvalid) {
      setMessage({ type: 'error', text: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
      return;
    }

    try {
      const formData = new FormData();
      Object.keys(editForm).forEach((key) => {
        if (key === 'id') return;
        if (editForm[key] !== null && editForm[key] !== undefined && editForm[key] !== '') {
          formData.append(key, editForm[key]);
        }
      });
      if (editFile) {
        formData.append('screenshot', editFile);
      }

      await apiRequest(`/incentives/submissions/${editForm.id}/self`, {
        method: 'PUT',
        body: formData,
        headers: {}, // browser sets multipart boundary
      });

      setMessage({ type: 'success', text: 'Submission updated.' });
      closeEdit();
      await loadData();
    } catch (error) {
      const msg = String(error?.message || 'Request failed');
      if (msg.toLowerCase().includes('office') || msg.includes('403')) {
        setOfficeOnlyBlocked(true);
        setMessage({ type: 'warning', text: 'Editing incentives is allowed only from office-approved network.' });
        closeEdit();
        return;
      }
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleSubmit = async () => {
    if (officeOnlyBlocked) {
      setMessage({ type: 'warning', text: 'Incentive submission is available only from office-approved network.' });
      return;
    }
    if (rateInvalid) {
      setMessage({ type: 'error', text: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
      return;
    }

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
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenRequestDialog(true)} disabled={officeOnlyBlocked}>
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
                    <TableCell align="right">Edit</TableCell>
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
                      <TableCell align="right">
                        <Tooltip title={officeOnlyBlocked ? 'Office network required' : 'Edit (pending only)'}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => openEdit(row)}
                              disabled={officeOnlyBlocked || String(row.status) !== 'pending'}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
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
          {officeOnlyBlocked ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Incentive submission is available only from office-approved network.
            </Alert>
          ) : null}
          <TextField fullWidth required label="Client Name" margin="normal" value={requestForm.client_name} onChange={(e) => setRequestForm({ ...requestForm, client_name: e.target.value })} />
          <TextField fullWidth required label="Client Mobile No 1" margin="normal" value={requestForm.client_mobile_1} onChange={(e) => setRequestForm({ ...requestForm, client_mobile_1: e.target.value })} />
          <TextField fullWidth label="Client Mobile No 2" margin="normal" value={requestForm.client_mobile_2} onChange={(e) => setRequestForm({ ...requestForm, client_mobile_2: e.target.value })} />
          <TextField fullWidth required label="Client Email" margin="normal" value={requestForm.client_email} onChange={(e) => setRequestForm({ ...requestForm, client_email: e.target.value })} />
          <TextField fullWidth label="Client User Name" margin="normal" value={requestForm.client_username} onChange={(e) => setRequestForm({ ...requestForm, client_username: e.target.value })} />
          <TextField fullWidth select label="Product Name" margin="normal" value={requestForm.product_name} onChange={(e) => setRequestForm({ ...requestForm, product_name: e.target.value })}>
            {productOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>
          
          {getIncentiveDetails(requestForm.product_name)}
          
          {['Bulk SMS', 'WhatsApp SMS'].includes(requestForm.product_name) && (
            <>
              <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={requestForm.sms_quantity} onChange={(e) => setRequestForm({ ...requestForm, sms_quantity: e.target.value })} />
              <TextField fullWidth label="Rate" type="number" margin="normal" value={requestForm.rate} onChange={(e) => setRequestForm({ ...requestForm, rate: e.target.value })} error={rateInvalid} helperText={rateInvalid ? "Enter paisa rate like 0.12 (must be < 1)." : "Example: 0.12"} inputProps={{ step: "0.01", min: 0, max: 0.9999 }} />
            </>
          )}

          <TextField fullWidth label="Price" type="number" margin="normal" value={requestForm.price} onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })} />
          
          {calculatedIncentive > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} color="success.contrastText">
                Estimated Incentive: {calculatedIncentive.toFixed(2)}
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
          <Button variant="contained" onClick={handleSubmit} disabled={officeOnlyBlocked}>Submit</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Submission</DialogTitle>
        <DialogContent>
          {officeOnlyBlocked ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Editing incentives is available only from office-approved network.
            </Alert>
          ) : null}
          {editForm ? (
            <>
              <TextField fullWidth required label="Client Name" margin="normal" value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} />
              <TextField fullWidth required label="Client Mobile No 1" margin="normal" value={editForm.client_mobile_1} onChange={(e) => setEditForm({ ...editForm, client_mobile_1: e.target.value })} />
              <TextField fullWidth label="Client Mobile No 2" margin="normal" value={editForm.client_mobile_2} onChange={(e) => setEditForm({ ...editForm, client_mobile_2: e.target.value })} />
              <TextField fullWidth required label="Client Email" margin="normal" value={editForm.client_email} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} />
              <TextField fullWidth label="Client User Name" margin="normal" value={editForm.client_username} onChange={(e) => setEditForm({ ...editForm, client_username: e.target.value })} />
              <TextField fullWidth select label="Product Name" margin="normal" value={editForm.product_name} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}>
                {productOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </TextField>

              {['Bulk SMS', 'WhatsApp SMS'].includes(editForm.product_name) && (
                <>
                  <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={editForm.sms_quantity} onChange={(e) => setEditForm({ ...editForm, sms_quantity: e.target.value })} />
                  <TextField fullWidth label="Rate" type="number" margin="normal" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} error={editRateInvalid} helperText={editRateInvalid ? "Enter paisa rate like 0.12 (must be < 1)." : "Example: 0.12"} inputProps={{ step: "0.01", min: 0, max: 0.9999 }} />
                </>
              )}

              <TextField fullWidth label="Price" type="number" margin="normal" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              <TextField fullWidth label="Payment Mode" margin="normal" value={editForm.payment_mode} onChange={(e) => setEditForm({ ...editForm, payment_mode: e.target.value })} />
              <TextField fullWidth select label="Client Package Type" margin="normal" value={editForm.package_type} onChange={(e) => setEditForm({ ...editForm, package_type: e.target.value })}>
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="renew">Renew</MenuItem>
              </TextField>
              <TextField fullWidth label="Client Location" margin="normal" value={editForm.client_location} onChange={(e) => setEditForm({ ...editForm, client_location: e.target.value })} />

              <Button component="label" variant="outlined" startIcon={<UploadFile />} sx={{ mt: 1 }} disabled={officeOnlyBlocked}>
                Replace Screenshot (Optional)
                <input type="file" hidden onChange={handleEditFileChange} />
              </Button>
              {editFile ? <Typography variant="body2" sx={{ mt: 1 }}>{editFile.name}</Typography> : null}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm || editRateInvalid || officeOnlyBlocked}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
