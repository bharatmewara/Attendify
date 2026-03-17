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
  Tab,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
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
  const [activeTab, setActiveTab] = useState(0);
  const [hrDocuments, setHrDocuments] = useState([]);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);

  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hrFilters, setHrFilters] = useState({ employee_id: '', document_type: '' });
  const [empFilters, setEmpFilters] = useState({ employee_id: '', document_type: '' });
  const [formData, setFormData] = useState(initialForm);

  const loadData = async () => {
    try {
      const hrParams = new URLSearchParams();
      if (hrFilters.employee_id) hrParams.append('employee_id', hrFilters.employee_id);
      if (hrFilters.document_type) hrParams.append('document_type', hrFilters.document_type);

      const empParams = new URLSearchParams();
      if (empFilters.employee_id) empParams.append('employee_id', empFilters.employee_id);
      if (empFilters.document_type) empParams.append('document_type', empFilters.document_type);

      const [hrDocsData, empDocsData, employeesData, templatesData] = await Promise.all([
        apiRequest(`/documents${hrParams.toString() ? `?${hrParams.toString()}` : ''}`),
        apiRequest(`/employees/documents${empParams.toString() ? `?${empParams.toString()}` : ''}`),
        apiRequest('/employees'),
        apiRequest('/documents/templates'),
      ]);
      setHrDocuments(hrDocsData);
      setEmployeeDocuments(empDocsData);
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
  }, [hrFilters.employee_id, hrFilters.document_type, empFilters.employee_id, empFilters.document_type]);

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

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="HR Generated Documents" />
        <Tab label="Employee Submitted Documents" />
      </Tabs>

      <Card sx={{ mb: 3, borderRadius: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                select 
                label="Employee" 
                value={activeTab === 0 ? hrFilters.employee_id : empFilters.employee_id} 
                onChange={(e) => {
                  if (activeTab === 0) setHrFilters({ ...hrFilters, employee_id: e.target.value });
                  else setEmpFilters({ ...empFilters, employee_id: e.target.value });
                }}
              >
                <MenuItem value="">All Employees</MenuItem>
                {employees.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} ({employee.employee_code})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                select 
                label="Document Type" 
                value={activeTab === 0 ? hrFilters.document_type : empFilters.document_type} 
                onChange={(e) => {
                  if (activeTab === 0) setHrFilters({ ...hrFilters, document_type: e.target.value });
                  else setEmpFilters({ ...empFilters, document_type: e.target.value });
                }}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="offer_letter">Offer Letter</MenuItem>
                <MenuItem value="appointment_letter">Appointment Letter</MenuItem>
                <MenuItem value="agreement">Agreement</MenuItem>
                <MenuItem value="termination_letter">Termination Letter</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="aadhar">Aadhar</MenuItem>
                <MenuItem value="pan">PAN</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            {activeTab === 0 ? 'HR Generated Documents' : 'Employee Submitted Documents'}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>{activeTab === 0 ? 'Title' : 'Document Name'}</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Preview</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(activeTab === 0 ? hrDocuments : employeeDocuments).map((document) => (
                  <TableRow key={document.id} hover>
                    <TableCell>{document.first_name || document.last_name ? `${document.first_name} ${document.last_name}` : 'N/A'}</TableCell>
                    <TableCell><Chip label={document.document_type} size="small" /></TableCell>
                    <TableCell>{activeTab === 0 ? document.title : document.document_name}</TableCell>
                    <TableCell>{activeTab === 0 ? new Date(document.generated_at).toLocaleDateString() : new Date(document.uploaded_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
                        {document.content?.slice(0, 120)}... 
                        {document.file_url ? 'File available' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {activeTab === 0 ? (
                        <Button size="small" startIcon={<Download />} onClick={() => handleDownload(document)}>
                          Download HTML
                        </Button>
                      ) : (
                        <Button 
                          size="small" 
                          startIcon={<Download />} 
                          onClick={() => window.open(document.file_url, '_blank')}
                          disabled={!document.file_url}
                        >
                          {document.file_url ? 'View File' : 'No File'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {activeTab === 1 && employeeDocuments.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No employee submitted documents found. Check Employee Management for uploads.
            </Typography>
          )}
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
