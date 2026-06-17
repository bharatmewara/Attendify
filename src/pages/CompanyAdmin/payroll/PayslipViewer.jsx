import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, Divider, CircularProgress,
  Alert, Table, TableBody, TableCell, TableRow, TableHead,
  TableContainer, Chip, Grid, Avatar,
} from '@mui/material';
import { Print, ArrowBack, Download } from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';
import PayslipDocument from '../../../components/payroll/PayslipDocument';
import { useAuth } from '../../../context/AuthContext';

export default function PayslipViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user }  = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const isEmployee = user?.role === 'employee';
    const endpoint   = isEmployee
      ? `/payroll/my-payslips/${id}`
      : `/payroll/run-items/${id}/payslip`;

    apiRequest(endpoint)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Box sx={{ p: 4 }}>
      <Alert severity="error">{error}</Alert>
      <Button sx={{ mt: 2 }} onClick={() => navigate(-1)} startIcon={<ArrowBack />}>Back</Button>
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }} className="payslip-no-print">
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined">Back</Button>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>Payslip Preview</Typography>
      </Box>
      {data && <PayslipDocument data={data} />}
    </Box>
  );
}
