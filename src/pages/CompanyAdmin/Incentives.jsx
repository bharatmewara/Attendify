import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Check, Close } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

export default function IncentivesManagement() {
  const [requests, setRequests] = useState([]);
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

  const pendingCount = useMemo(() => requests.filter((item) => item.status === 'pending').length, [requests]);

  const handleUpdateStatus = async (id, status) => {
    try {
      await apiRequest(`/incentives/submissions/${id}/status`, {
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
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={800}>Incentive Management</Typography>
                <Typography color="text.secondary">Approve or reject employee incentive submissions.</Typography>
              </Box>
              <Chip color={pendingCount ? 'warning' : 'success'} label={`Pending Requests: ${pendingCount}`} />
            </Stack>
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
                    <TableCell>Client</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Incentive</TableCell>
                    <TableCell>Screenshot</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.first_name} {row.last_name}</TableCell>
                      <TableCell>{row.client_name}</TableCell>
                      <TableCell>{row.product_name}</TableCell>
                      <TableCell>{Number(row.price).toLocaleString()}</TableCell>
                      <TableCell>{Number(row.incentive_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        {row.screenshot_path ? (
                          <Button size="small" variant="text" href={`/${row.screenshot_path}`} target="_blank">View</Button>
                        ) : 'N/A'}
                      </TableCell>
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
    </Box>
  );
}
