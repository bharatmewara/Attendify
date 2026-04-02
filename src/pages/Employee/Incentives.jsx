import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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

const capitalizeStatus = (status) => {
  if (!status) return '';
  return String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
};

const requestInitial = {
  client_name: '',
  product_name: 'Bulk SMS',
  client_mobile_1: '',
  client_mobile_2: '',
  client_email: '',
  client_panel_username: '',
  client_panel_password: '',
  sms_quantity: '',
  rate: '',
  gst_applied: true,
  price_gross: '',
  price: '',
  payment_mode: '',
  package_type: 'new',
  client_location: '',
  screenshot: null,
};

const fallbackProductOptions = [
  'Bulk SMS',
  'WhatsApp SMS',
  'WhatsApp Meta Setup',
  'WhatsApp Meta Recharge',
  'WhatsApp Meta Subscription',
  'RCS Setup',
  'RCS Recharge',
];

const buildPreviewPayload = (form) => ({
  product_name: form?.product_name,
  package_type: form?.package_type,
  sms_quantity: form?.sms_quantity === '' ? null : form?.sms_quantity,
  rate: form?.rate === '' ? null : form?.rate,
  price: form?.price === '' ? null : form?.price,
  gst_applied: Boolean(form?.gst_applied),
  price_gross: form?.price_gross === '' ? null : form?.price_gross,
});

const GST_RATE = 0.18;
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;
const calcNetFromGross = (gross) => roundMoney(Number(gross) / (1 + GST_RATE));

export default function EmployeeIncentives() {
  const [requests, setRequests] = useState([]);
  const [openRequestDialog, setOpenRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState(requestInitial);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [calculatedIncentive, setCalculatedIncentive] = useState(0);
  const [officeOnlyBlocked, setOfficeOnlyBlocked] = useState(false);
  const [productOptions, setProductOptions] = useState(fallbackProductOptions);

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
    (async () => {
      try {
        const products = await apiRequest('/incentives/products');
        if (Array.isArray(products) && products.length) {
          setProductOptions(products);
          if (!products.includes(requestForm.product_name)) {
            setRequestForm((cur) => ({ ...cur, product_name: products[0] }));
          }
        }
      } catch (error) {
        // If employee is outside office network, this will be blocked; loadData already shows a warning.
      }
    })();
  }, []);

  useEffect(() => {
    if (officeOnlyBlocked) return;
    if (!requestForm.product_name || !requestForm.package_type) return;

    const handle = setTimeout(async () => {
      try {
        const res = await apiRequest('/incentives/preview', { method: 'POST', body: buildPreviewPayload(requestForm) });
        setCalculatedIncentive(Number(res?.incentive_amount || 0));
      } catch {
        // ignore preview failures (submit will still validate server-side)
      }
    }, 350);

    return () => clearTimeout(handle);
  }, [officeOnlyBlocked, requestForm.product_name, requestForm.sms_quantity, requestForm.rate, requestForm.price, requestForm.package_type]);

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
      client_panel_username: row.client_panel_username || '',
      client_panel_password: '',
      sms_quantity: row.sms_quantity ?? '',
      rate: row.rate ?? '',
      gst_applied: String(row.package_type || '').toLowerCase() === 'new' ? Boolean(row.gst_applied ?? true) : false,
      price_gross: row.price_gross ?? '',
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
    Object.keys(requestForm).forEach((key) => {
      const value = requestForm[key];
      if (key === 'screenshot') {
        if (requestForm.screenshot) formData.append('screenshot', requestForm.screenshot);
        return;
      }
      if (value === '' || value === null || value === undefined) return;
      formData.append(key, value);
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
                          label={capitalizeStatus(row.status)}
                          color={row.status === 'approved' ? 'success' : ['rejected', 'refunded'].includes(String(row.status)) ? 'error' : 'warning'}
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
          <TextField fullWidth label="Client Panel Username" margin="normal" value={requestForm.client_panel_username} onChange={(e) => setRequestForm({ ...requestForm, client_panel_username: e.target.value })} />
          <TextField fullWidth label="Client Panel Password" margin="normal" value={requestForm.client_panel_password} onChange={(e) => setRequestForm({ ...requestForm, client_panel_password: e.target.value })} />
           <TextField fullWidth select label="Product Name" margin="normal" value={requestForm.product_name} onChange={(e) => setRequestForm({ ...requestForm, product_name: e.target.value })}>
             {productOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
           </TextField>

          <Alert severity="info" sx={{ mt: 1 }}>
            Incentive is calculated automatically based on admin rules.
          </Alert>

          {['Bulk SMS', 'WhatsApp SMS'].includes(requestForm.product_name) && (
            <>
              <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={requestForm.sms_quantity} onChange={(e) => setRequestForm({ ...requestForm, sms_quantity: e.target.value })} />
              <TextField fullWidth label="Rate" type="number" margin="normal" value={requestForm.rate} onChange={(e) => setRequestForm({ ...requestForm, rate: e.target.value })} error={rateInvalid} helperText={rateInvalid ? "Enter paisa rate like 0.12 (must be < 1)." : "Example: 0.12"} inputProps={{ step: "0.01", min: 0, max: 0.9999 }} />
            </>
          )}

          {String(requestForm.package_type || '').toLowerCase() === 'new' ? (
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Checkbox
                  checked={Boolean(requestForm.gst_applied)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRequestForm((current) => {
                      if (!checked) {
                        const nextPrice = current.price_gross !== '' ? current.price_gross : current.price;
                        return { ...current, gst_applied: false, price_gross: '', price: nextPrice };
                      }

                      const gross = current.price_gross !== '' ? current.price_gross : current.price;
                      if (gross === '' || gross === null || gross === undefined) {
                        return { ...current, gst_applied: true, price_gross: '', price: current.price };
                      }
                      return { ...current, gst_applied: true, price_gross: gross, price: String(calcNetFromGross(gross)) };
                    });
                  }}
                />
              }
              label="Apply GST (18%)"
            />
          ) : null}

          {String(requestForm.package_type || '').toLowerCase() === 'new' && requestForm.gst_applied ? (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 0.5 }}>
              <TextField
                fullWidth
                label="Price (incl GST)"
                type="number"
                margin="normal"
                value={requestForm.price_gross}
                onChange={(e) => {
                  const gross = e.target.value;
                  setRequestForm((current) => ({
                    ...current,
                    price_gross: gross,
                    price: gross === '' ? '' : String(calcNetFromGross(gross)),
                  }));
                }}
              />
              <TextField
                fullWidth
                label="Price (excl GST)"
                type="number"
                margin="normal"
                value={requestForm.price}
                InputProps={{ readOnly: true }}
                helperText="Auto-calculated (used for incentive)."
              />
            </Stack>
          ) : (
            <TextField fullWidth label="Price" type="number" margin="normal" value={requestForm.price} onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })} />
          )}
          
          {calculatedIncentive > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} color="success.contrastText">
                Estimated Incentive: {calculatedIncentive.toFixed(2)}
              </Typography>
            </Box>
          )}
          <TextField fullWidth label="Payment Mode" margin="normal" value={requestForm.payment_mode} onChange={(e) => setRequestForm({ ...requestForm, payment_mode: e.target.value })} />
          <TextField
            fullWidth
            select
            label="Client Package Type"
            margin="normal"
            value={requestForm.package_type}
            onChange={(e) => {
              const nextType = e.target.value;
              setRequestForm((current) => {
                const next = { ...current, package_type: nextType };
                if (String(nextType || '').toLowerCase() !== 'new') {
                  return { ...next, gst_applied: false, price_gross: '' };
                }
                return { ...next, gst_applied: current.gst_applied ?? true };
              });
            }}
          >
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
              <TextField fullWidth label="Client Panel Username" margin="normal" value={editForm.client_panel_username} onChange={(e) => setEditForm({ ...editForm, client_panel_username: e.target.value })} />
              <TextField fullWidth label="Client Panel Password" margin="normal" value={editForm.client_panel_password} onChange={(e) => setEditForm({ ...editForm, client_panel_password: e.target.value })} helperText="Leave blank to keep existing password." />
              <TextField fullWidth select label="Product Name" margin="normal" value={editForm.product_name} onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}>
                {productOptions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </TextField>

              {['Bulk SMS', 'WhatsApp SMS'].includes(editForm.product_name) && (
                <>
                  <TextField fullWidth label="SMS Quantity" type="number" margin="normal" value={editForm.sms_quantity} onChange={(e) => setEditForm({ ...editForm, sms_quantity: e.target.value })} />
                  <TextField fullWidth label="Rate" type="number" margin="normal" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} error={editRateInvalid} helperText={editRateInvalid ? "Enter paisa rate like 0.12 (must be < 1)." : "Example: 0.12"} inputProps={{ step: "0.01", min: 0, max: 0.9999 }} />
                </>
              )}

              {String(editForm.package_type || '').toLowerCase() === 'new' ? (
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Checkbox
                      checked={Boolean(editForm.gst_applied)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditForm((current) => {
                          if (!current) return current;
                          if (!checked) {
                            const nextPrice = current.price_gross !== '' ? current.price_gross : current.price;
                            return { ...current, gst_applied: false, price_gross: '', price: nextPrice };
                          }

                          const gross = current.price_gross !== '' ? current.price_gross : current.price;
                          if (gross === '' || gross === null || gross === undefined) {
                            return { ...current, gst_applied: true, price_gross: '', price: current.price };
                          }
                          return { ...current, gst_applied: true, price_gross: gross, price: String(calcNetFromGross(gross)) };
                        });
                      }}
                    />
                  }
                  label="Apply GST (18%)"
                />
              ) : null}

              {String(editForm.package_type || '').toLowerCase() === 'new' && editForm.gst_applied ? (
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 0.5 }}>
                  <TextField
                    fullWidth
                    label="Price (incl GST)"
                    type="number"
                    margin="normal"
                    value={editForm.price_gross}
                    onChange={(e) => {
                      const gross = e.target.value;
                      setEditForm((current) => {
                        if (!current) return current;
                        return { ...current, price_gross: gross, price: gross === '' ? '' : String(calcNetFromGross(gross)) };
                      });
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Price (excl GST)"
                    type="number"
                    margin="normal"
                    value={editForm.price}
                    InputProps={{ readOnly: true }}
                    helperText="Auto-calculated (used for incentive)."
                  />
                </Stack>
              ) : (
                <TextField fullWidth label="Price" type="number" margin="normal" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              )}
              <TextField fullWidth label="Payment Mode" margin="normal" value={editForm.payment_mode} onChange={(e) => setEditForm({ ...editForm, payment_mode: e.target.value })} />
              <TextField
                fullWidth
                select
                label="Client Package Type"
                margin="normal"
                value={editForm.package_type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setEditForm((current) => {
                    if (!current) return current;
                    const next = { ...current, package_type: nextType };
                    if (String(nextType || '').toLowerCase() !== 'new') {
                      return { ...next, gst_applied: false, price_gross: '' };
                    }
                    return { ...next, gst_applied: current.gst_applied ?? true };
                  });
                }}
              >
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
