import { useEffect, useMemo, useState } from 'react';
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
import { Add, Check, Close } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const configInitial = {
  incentive_type: 'bulk_sms',
  package_volume: 100000,
  unit_price: 0.8,
  incentive_amount: 200,
};

export default function IncentivesManagement() {
  const [configs, setConfigs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [openConfigDialog, setOpenConfigDialog] = useState(false);
  const [configForm, setConfigForm] = useState(configInitial);
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

  const pendingCount = useMemo(() => requests.filter((item) => item.status === 'pending').length, [requests]);

  const handleCreateConfig = async () => {
    try {
      await apiRequest('/incentives/config', { method: 'POST', body: configForm });
      setOpenConfigDialog(false);
      setConfigForm(configInitial);
      setMessage({ type: 'success', text: 'Incentive rule added.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await apiRequest(`/incentives/requests/${id}/status`, {
        method: 'PUT',
        body: { status },
      });
      setMessage({ type: 'success', text: `Request ${status}.` });
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
                <Typography variant="h5" fontWeight={800}>Incentive Management</Typography>
                <Typography color="text.secondary">Configure incentive slabs and approve employee requests.</Typography>
              </Box>
              <Stack direction="row" spacing={1.25}>
                <Chip color={pendingCount ? 'warning' : 'success'} label={`Pending Requests: ${pendingCount}`} />
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenConfigDialog(true)}>
                  Add Incentive Rule
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Incentive Rules</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Price / Unit</TableCell>
                    <TableCell>Incentive</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {configs.map((cfg) => (
                    <TableRow key={cfg.id}>
                      <TableCell>{cfg.incentive_type}</TableCell>
                      <TableCell>{Number(cfg.package_volume).toLocaleString()}</TableCell>
                      <TableCell>{cfg.unit_price}</TableCell>
                      <TableCell>{cfg.incentive_amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>Request Queue</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Package</TableCell>
                    <TableCell>Payment</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.first_name} {row.last_name}</TableCell>
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
                      <TableCell align="right">
                        {row.status === 'pending' ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button size="small" variant="contained" color="success" startIcon={<Check />} onClick={() => handleUpdateStatus(row.id, 'approved')}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<Close />} onClick={() => handleUpdateStatus(row.id, 'rejected')}>
                              Reject
                            </Button>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">Processed</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={openConfigDialog} onClose={() => setOpenConfigDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Incentive Rule</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Incentive Type" margin="normal" value={configForm.incentive_type} onChange={(e) => setConfigForm({ ...configForm, incentive_type: e.target.value })}>
            <MenuItem value="bulk_sms">Bulk SMS</MenuItem>
            <MenuItem value="package_sell">Package Sell</MenuItem>
            <MenuItem value="renewal">Renewal</MenuItem>
          </TextField>
          <TextField fullWidth label="Package Volume" type="number" margin="normal" value={configForm.package_volume} onChange={(e) => setConfigForm({ ...configForm, package_volume: Number(e.target.value) })} />
          <TextField fullWidth label="Price / Unit" type="number" margin="normal" value={configForm.unit_price} onChange={(e) => setConfigForm({ ...configForm, unit_price: Number(e.target.value) })} />
          <TextField fullWidth label="Incentive Amount" type="number" margin="normal" value={configForm.incentive_amount} onChange={(e) => setConfigForm({ ...configForm, incentive_amount: Number(e.target.value) })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfigDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateConfig}>Save Rule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
