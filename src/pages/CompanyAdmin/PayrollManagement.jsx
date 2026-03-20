import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Snackbar,
} from '@mui/material';
import { Calculate, Download } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { buildPayslipHtml, currency, downloadBlob } from '../../utils/fileExports';

const defaultSalaryData = {
  employee_id: '',
  basic_salary: '',
  allowances: { hra: 0, transport: 0, medical: 0, bonus: 0, special: 0 },
  deductions: { pf: 0, tax: 0, esi: 0, loan: 0, other: 0 },
  effective_from: new Date().toISOString().split('T')[0],
};

const defaultTemplate = {
  accentColor: '#0f766e',
  heading: 'Employee Payslip',
  note: 'This payslip has been generated from Attendify payroll management.',
};

export default function PayrollManagement() {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openSalaryDialog, setOpenSalaryDialog] = useState(false);
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employee_id: '',
  });
  const [salaryData, setSalaryData] = useState(defaultSalaryData);
  const [payslipTemplate, setPayslipTemplate] = useState(defaultTemplate);

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const loadData = async () => {
    try {
      const params = new URLSearchParams({
        month: String(filters.month),
        year: String(filters.year),
      });
      if (filters.employee_id) params.append('employee_id', filters.employee_id);

      const [payrollData, employeesData] = await Promise.all([
        apiRequest(`/payroll/records?${params.toString()}`),
        apiRequest('/employees'),
      ]);
      setPayrolls(payrollData);
      setEmployees(employeesData);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.month, filters.year, filters.employee_id]);

  const updateMoneyGroup = (group, key, value) => {
    setSalaryData((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: Number(value),
      },
    }));
  };

  const handleCalculatePayroll = async () => {
    try {
      await apiRequest('/payroll/calculate', {
        method: 'POST',
        body: filters.employee_id ? filters : { month: filters.month, year: filters.year },
      });
      setOpenDialog(false);
      setMessage({ type: 'success', text: 'Payroll calculated successfully.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleSaveSalary = async () => {
    try {
      await apiRequest('/payroll/salary-structure', {
        method: 'POST',
        body: salaryData,
      });
      setOpenSalaryDialog(false);
      setSalaryData(defaultSalaryData);
      setMessage({ type: 'success', text: 'Salary structure saved successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleGeneratePayslip = async (payrollId) => {
    try {
      await apiRequest(`/payroll/payslips/${payrollId}`, { method: 'POST' });
      setMessage({ type: 'success', text: 'Payslip generated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDownloadPayslip = async (payroll) => {
    const employee = employeeMap[payroll.employee_id];
    const html = buildPayslipHtml({
      payroll,
      employee,
      companyName: employee?.company_name || 'Attendify',
      template: payslipTemplate,
    });
    downloadBlob(html, `payslip-${employee?.employee_code || payroll.employee_id}-${payroll.month}-${payroll.year}.html`, 'text/html;charset=utf-8');
    setMessage({ type: 'success', text: 'Payslip downloaded with the current customization template.' });
  };

  const totals = useMemo(() => {
    const gross = payrolls.reduce((sum, item) => sum + Number(item.gross_salary || 0), 0);
    const net = payrolls.reduce((sum, item) => sum + Number(item.net_salary || 0), 0);
    return { gross, net };
  }, [payrolls]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Payroll Management</Typography>
          <Typography color="text.secondary">Salary structures, deductions, payroll calculations, and customizable payslip downloads.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <Button variant="outlined" onClick={() => setOpenTemplateDialog(true)}>Customize Payslip</Button>
          <Button variant="outlined" onClick={() => setOpenSalaryDialog(true)}>Set Salary</Button>
          <Button variant="contained" startIcon={<Calculate />} onClick={() => setOpenDialog(true)}>Calculate Payroll</Button>
        </Box>
      </Box>

      <Snackbar 
        open={Boolean(message.text)} 
        autoHideDuration={6000} 
        onClose={() => setMessage({ type: '', text: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity={message.type || 'info'} variant="filled" sx={{ width: '100%', borderRadius: 2, boxShadow: 3 }}>
          {message.text}
        </Alert>
      </Snackbar>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}><CardContent><Typography color="text.secondary">Records</Typography><Typography variant="h4" fontWeight={800}>{payrolls.length}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}><CardContent><Typography color="text.secondary">Gross Payroll</Typography><Typography variant="h5" fontWeight={800}>{currency(totals.gross)}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}><CardContent><Typography color="text.secondary">Net Payroll</Typography><Typography variant="h5" fontWeight={800}>{currency(totals.net)}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ borderRadius: 4 }}><CardContent><Typography color="text.secondary">Pay Period</Typography><Typography variant="h5" fontWeight={800}>{new Date(filters.year, filters.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Typography></CardContent></Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3, borderRadius: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField fullWidth select label="Month" value={filters.month} onChange={(e) => setFilters({ ...filters, month: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, index) => (
                  <MenuItem key={index + 1} value={index + 1}>
                    {new Date(2026, index).toLocaleString('en-IN', { month: 'long' })}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth select label="Year" value={filters.year} onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}>
                {[2024, 2025, 2026, 2027].map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField fullWidth select label="Employee" value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Payroll Records</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Basic</TableCell>
                  <TableCell>Allowances</TableCell>
                  <TableCell>Deductions</TableCell>
                  <TableCell>Net Salary</TableCell>
                  <TableCell>Attendance</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payrolls.map((payroll) => (
                  <TableRow key={payroll.id} hover>
                    <TableCell>{payroll.first_name} {payroll.last_name}</TableCell>
                    <TableCell>{currency(payroll.basic_salary)}</TableCell>
                    <TableCell>{currency(payroll.total_allowances)}</TableCell>
                    <TableCell>{currency(Number(payroll.total_deductions) + Number(payroll.late_penalties) + Number(payroll.early_leave_penalties))}</TableCell>
                    <TableCell><strong>{currency(payroll.net_salary)}</strong></TableCell>
                    <TableCell>{payroll.present_days}P / {payroll.absent_days}A / {payroll.leave_days}L</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleGeneratePayslip(payroll.id)}>Generate</Button>
                      <Button size="small" startIcon={<Download />} onClick={() => handleDownloadPayslip(payroll)}>Download</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Calculate Payroll</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 2 }}>
            Calculate payroll for {new Date(filters.year, filters.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}{filters.employee_id ? ' for the selected employee' : ' for all active employees'}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCalculatePayroll} variant="contained">Calculate</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openSalaryDialog} onClose={() => setOpenSalaryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Set Salary Structure</DialogTitle>
        <DialogContent>
          <TextField fullWidth select label="Employee" value={salaryData.employee_id} onChange={(e) => setSalaryData({ ...salaryData, employee_id: e.target.value })} margin="normal">
            {employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.first_name} {employee.last_name} ({employee.employee_code})
              </MenuItem>
            ))}
          </TextField>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Basic Salary" type="number" value={salaryData.basic_salary} onChange={(e) => setSalaryData({ ...salaryData, basic_salary: Number(e.target.value) })} margin="normal" />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Effective From" type="date" InputLabelProps={{ shrink: true }} value={salaryData.effective_from} onChange={(e) => setSalaryData({ ...salaryData, effective_from: e.target.value })} margin="normal" />
            </Grid>
            {Object.entries(salaryData.allowances).map(([key, value]) => (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <TextField fullWidth label={`Allowance: ${key}`} type="number" value={value} onChange={(e) => updateMoneyGroup('allowances', key, e.target.value)} margin="normal" />
              </Grid>
            ))}
            {Object.entries(salaryData.deductions).map(([key, value]) => (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <TextField fullWidth label={`Deduction: ${key}`} type="number" value={value} onChange={(e) => updateMoneyGroup('deductions', key, e.target.value)} margin="normal" />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSalaryDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveSalary} variant="contained">Save Salary</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Customize Payslip Template</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Heading" value={payslipTemplate.heading} onChange={(e) => setPayslipTemplate({ ...payslipTemplate, heading: e.target.value })} margin="normal" />
          <TextField fullWidth label="Accent Color" value={payslipTemplate.accentColor} onChange={(e) => setPayslipTemplate({ ...payslipTemplate, accentColor: e.target.value })} margin="normal" helperText="Use hex values like #0f766e" />
          <TextField fullWidth label="Footer Note" multiline rows={4} value={payslipTemplate.note} onChange={(e) => setPayslipTemplate({ ...payslipTemplate, note: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
