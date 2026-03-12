import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { AccessTime, Description, EventAvailable, ReceiptLong } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { buildDocumentHtml, buildPayslipHtml, currency, downloadBlob } from '../../utils/fileExports';

export default function EmployeeDashboard() {
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = async () => {
    try {
      const [attendanceData, balanceData, leavesData, payslipsData, documentsData] = await Promise.all([
        apiRequest('/attendance/today'),
        apiRequest('/leave/balance'),
        apiRequest('/leave/requests'),
        apiRequest('/payroll/payslips'),
        apiRequest('/documents'),
      ]);
      setTodayAttendance(attendanceData);
      setLeaveBalance(balanceData);
      setRecentLeaves(leavesData);
      setPayslips(payslipsData);
      setDocuments(documentsData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePunchIn = async () => {
    try {
      await apiRequest('/attendance/punch-in', {
        method: 'POST',
        body: { location: 'Web Portal' },
      });
      setMessage({ type: 'success', text: 'Punch in recorded.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handlePunchOut = async () => {
    try {
      await apiRequest('/attendance/punch-out', {
        method: 'POST',
        body: { location: 'Web Portal' },
      });
      setMessage({ type: 'success', text: 'Punch out recorded.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const downloadPayslip = (payslip) => {
    const html = buildPayslipHtml({
      payroll: {
        ...payslip,
        basic_salary: payslip.net_salary,
        total_allowances: 0,
        total_deductions: 0,
        late_penalties: 0,
        early_leave_penalties: 0,
        gross_salary: payslip.net_salary,
        present_days: 0,
        absent_days: 0,
        leave_days: 0,
        status: 'processed',
      },
      employee: {},
      companyName: 'Attendify',
    });
    downloadBlob(html, `payslip-${payslip.month}-${payslip.year}.html`, 'text/html;charset=utf-8');
  };

  const downloadDocument = (document) => {
    const html = buildDocumentHtml({
      title: document.title,
      employeeName: '',
      companyName: 'Attendify',
      content: document.content,
    });
    downloadBlob(html, `${document.document_type}-${document.id}.html`, 'text/html;charset=utf-8');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 3 }}>
        Employee Dashboard
      </Typography>

      {message.text ? (
        <Alert severity={message.type || 'info'} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      ) : null}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccessTime sx={{ fontSize: 36, mr: 1.5, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={700}>Today's Attendance</Typography>
              </Box>
              {todayAttendance ? (
                <Box>
                  <Typography>Punch In: {todayAttendance.punch_in_time ? new Date(todayAttendance.punch_in_time).toLocaleTimeString() : 'Not punched in'}</Typography>
                  <Typography>Punch Out: {todayAttendance.punch_out_time ? new Date(todayAttendance.punch_out_time).toLocaleTimeString() : 'Not punched out'}</Typography>
                  <Typography sx={{ my: 1 }}>
                    Status: <Chip label={todayAttendance.status} size="small" />
                  </Typography>
                  {!todayAttendance.punch_in_time ? (
                    <Button variant="contained" color="success" onClick={handlePunchIn}>Punch In</Button>
                  ) : null}
                  {todayAttendance.punch_in_time && !todayAttendance.punch_out_time ? (
                    <Button variant="contained" color="error" onClick={handlePunchOut}>Punch Out</Button>
                  ) : null}
                </Box>
              ) : (
                <Box>
                  <Typography>No attendance record for today.</Typography>
                  <Button variant="contained" color="success" onClick={handlePunchIn} sx={{ mt: 2 }}>Punch In</Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EventAvailable sx={{ fontSize: 36, mr: 1.5, color: 'success.main' }} />
                <Typography variant="h6" fontWeight={700}>Leave Balance</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Used</TableCell>
                      <TableCell>Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveBalance.map((balance) => (
                      <TableRow key={balance.id}>
                        <TableCell>{balance.leave_type_name}</TableCell>
                        <TableCell>{balance.total_days}</TableCell>
                        <TableCell>{balance.used_days}</TableCell>
                        <TableCell>{balance.remaining_days}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ReceiptLong sx={{ fontSize: 36, mr: 1.5, color: 'warning.main' }} />
                <Typography variant="h6" fontWeight={700}>Recent Payslips</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell>Net Salary</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payslips.slice(0, 5).map((payslip) => (
                      <TableRow key={payslip.id}>
                        <TableCell>{new Date(payslip.year, payslip.month - 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>{currency(payslip.net_salary)}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => downloadPayslip(payslip)}>Download</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description sx={{ fontSize: 36, mr: 1.5, color: 'secondary.main' }} />
                <Typography variant="h6" fontWeight={700}>HR Documents</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {documents.slice(0, 5).map((document) => (
                      <TableRow key={document.id}>
                        <TableCell>{document.title}</TableCell>
                        <TableCell><Chip label={document.document_type} size="small" /></TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => downloadDocument(document)}>Download</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Recent Leave Requests</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentLeaves.slice(0, 5).map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell>{leave.leave_type_name}</TableCell>
                        <TableCell>{new Date(leave.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Chip label={leave.status} size="small" color={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'error' : 'default'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
