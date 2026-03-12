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
} from '@mui/material';
import { Add, Download } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';
import { buildDocumentHtml, downloadBlob } from '../../utils/fileExports';

const initialForm = {
  employee_id: '',
  document_type: 'offer_letter',
  title: '',
  content: '',
};

export default function HRDocuments() {
  const [documents, setDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filters, setFilters] = useState({ employee_id: '', document_type: '' });
  const [formData, setFormData] = useState(initialForm);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (filters.document_type) params.append('document_type', filters.document_type);

      const [docsData, employeesData, templatesData] = await Promise.all([
        apiRequest(`/documents${params.toString() ? `?${params.toString()}` : ''}`),
        apiRequest('/employees'),
        apiRequest('/documents/templates'),
      ]);
      setDocuments(docsData);
      setEmployees(employeesData);
      setTemplates(templatesData);
      if (!formData.title && templatesData.offer_letter) {
        setFormData({
          ...initialForm,
          title: templatesData.offer_letter.title,
          content: templatesData.offer_letter.content,
        });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.employee_id, filters.document_type]);

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const handleTypeChange = (type) => {
    setFormData((current) => ({
      ...current,
      document_type: type,
      title: templates[type]?.title || '',
      content: templates[type]?.content || '',
    }));
  };

  const handleGenerate = async () => {
    try {
      await apiRequest('/documents', {
        method: 'POST',
        body: formData,
      });
      setOpenDialog(false);
      setMessage({ type: 'success', text: 'Document generated and sent to the employee dashboard.' });
      loadData();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleDownload = (document) => {
    const employee = employeeMap[document.employee_id];
    const html = buildDocumentHtml({
      title: document.title,
      employeeName: employee ? `${employee.first_name} ${employee.last_name}` : '',
      companyName: 'Attendify',
      content: document.content,
    });
    downloadBlob(html, `${document.document_type}-${document.id}.html`, 'text/html;charset=utf-8');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>HR Documents</Typography>
          <Typography color="text.secondary">Generate branded documents, monitor all employee paperwork, and deliver files directly to the employee dashboard.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
          Generate Document
        </Button>
      </Box>

      {message.text ? (
        <Alert severity={message.type || 'info'} sx={{ mb: 2 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      ) : null}

      <Card sx={{ mb: 3, borderRadius: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Employee" value={filters.employee_id} onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}>
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Document Type" value={filters.document_type} onChange={(e) => setFilters({ ...filters, document_type: e.target.value })}>
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="offer_letter">Offer Letter</MenuItem>
                <MenuItem value="appointment_letter">Appointment Letter</MenuItem>
                <MenuItem value="agreement">Agreement</MenuItem>
                <MenuItem value="termination_letter">Termination Letter</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Employee Documents</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Preview</TableCell>
                  <TableCell>Download</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id} hover>
                    <TableCell>{document.first_name} {document.last_name}</TableCell>
                    <TableCell><Chip label={document.document_type} size="small" /></TableCell>
                    <TableCell>{document.title}</TableCell>
                    <TableCell>{new Date(document.generated_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
                        {document.content?.slice(0, 120)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<Download />} onClick={() => handleDownload(document)}>
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Generate Document</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Employee" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} margin="normal">
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth select label="Type" value={formData.document_type} onChange={(e) => handleTypeChange(e.target.value)} margin="normal">
                <MenuItem value="offer_letter">Offer Letter</MenuItem>
                <MenuItem value="appointment_letter">Appointment Letter</MenuItem>
                <MenuItem value="agreement">Agreement</MenuItem>
                <MenuItem value="termination_letter">Termination Letter</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <TextField fullWidth label="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} margin="normal" />
          <TextField fullWidth multiline rows={10} label="Content" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} margin="normal" helperText="Supported placeholders: {employee_name}, {employee_code}, {email}, {designation}, {department}, {joining_date}, {company_name}, {company_address}, {date}" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleGenerate} variant="contained">Generate</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
