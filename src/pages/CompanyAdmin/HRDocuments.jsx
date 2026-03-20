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
  Divider,
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
  Snackbar,
} from '@mui/material';
import { Edit, Business, Image, Save } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useRef } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [company, setCompany] = useState(null);
  const [openCompanyForm, setOpenCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    company_name: '',
    logo: null,
    address: '',
    tel_no: '',
    phone: '',
    email: '',
    website: '',
  });
  const logoRef = useRef(null);
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
    setIsLoading(true);
    const hrParams = new URLSearchParams();
    if (hrFilters.employee_id) hrParams.append('employee_id', hrFilters.employee_id);
    if (hrFilters.document_type) hrParams.append('document_type', hrFilters.document_type);

    const empParams = new URLSearchParams();
    if (empFilters.employee_id) empParams.append('employee_id', empFilters.employee_id);
    if (empFilters.document_type) empParams.append('document_type', empFilters.document_type);

    const [hrDocsData, empDocsData, employeesData, templatesData, companyData] = await Promise.all([
      apiRequest(`/documents${hrParams.toString() ? `?${hrParams.toString()}` : ''}`),
      apiRequest(`/employees/documents${empParams.toString() ? `?${empParams.toString()}` : ''}`),
      apiRequest('/employees'),
      apiRequest('/documents/templates'),
      apiRequest('/organization/companies'),
    ]);
    setHrDocuments(hrDocsData);
    setEmployeeDocuments(empDocsData);
    setEmployees(employeesData);
    setTemplates(templatesData);
    setCompany(companyData);
    if (companyData) {
      setCompanyForm({
        company_name: companyData.company_name || '',
        logo: null, // Reset for upload
        address: companyData.address || '',
        tel_no: companyData.tel_no || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.website || '',
      });
      setCompany(companyData);
    }
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
  setIsLoading(false);
  setLoadError(null);
};



const loadDataSafe = async () => {
  try {
    setLoadError(null);
    await loadData();
  } catch (error) {
    console.error('Failed to load HR Documents data:', error);
    setLoadError(error.message);
    setIsLoading(false);
  }
};

useEffect(() => {
    loadDataSafe();
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

  const handleDownload = async (document) => {
    const employee = employeeMap[document.employee_id];
    const companyData = await apiRequest('/organization/companies');
    const html = buildDocumentHtml({
      title: document.title,
      employeeName: employee ? `${employee.first_name} ${employee.last_name}` : '',
      companyName: companyData.company_name || 'Attendify',
      companyLogo: companyData.logo ? `http://localhost:4000${companyData.logo}` : null,
      content: document.content,
    });
    downloadBlob(html, `${document.document_type}-${document.id}.html`, 'text/html;charset=utf-8');
  };

  const handleViewFile = async (document) => {
    const fileUrl = document.file_url;
    try {
      let response, blob;
      if (fileUrl.startsWith('data:')) {
        response = await fetch(fileUrl);
        blob = await response.blob();
      } else {
        response = await apiRequest(fileUrl);
        blob = new Blob([response], { type: 'application/octet-stream' });
      }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to view file: ${error.message}` });
    }
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

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="HR Generated Documents" />
        <Tab label="Employee Submitted Documents" />
        <Tab label="Company Details" />
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

      {isLoading && (
        <Card sx={{ borderRadius: 4, mt: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography>Loading documents...</Typography>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <Card sx={{ borderRadius: 4, mt: 2 }}>
          <CardContent>
            <Alert severity="error">
              Failed to load documents: {loadError}. Please refresh or check backend.
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            {activeTab === 2 ? 'Company Details' : activeTab === 0 ? 'HR Generated Documents' : 'Employee Submitted Documents'}
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
                          onClick={() => handleViewFile(document)}
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
          {activeTab === 2 ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                Company Information
              </Typography>
              {company ? (
                <Card variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Company Logo
                      </Typography>
                      {company.logo ? (
                        <Box sx={{ width: 120, height: 120, borderRadius: 2, overflow: 'hidden', border: 2, borderColor: 'grey.200' }}>
                          <img src={company.logo.startsWith('http') ? company.logo : `http://localhost:4000${company.logo}`} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                      ) : (
                        <Paper sx={{ width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                          <Business sx={{ fontSize: 40, color: 'grey.500' }} />
                        </Paper>
                      )}
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                        {company.company_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {company.industry || 'No industry'}
                      </Typography>
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 3 }} />
                  <Button 
                    variant="outlined" 
                    startIcon={<Edit />}
                    onClick={() => setOpenCompanyForm(true)}
                    fullWidth
                    sx={{ py: 1.5, borderRadius: 2 }}
                  >
                    Edit Company Details
                  </Button>
                </Card>
              ) : (
                <Typography>Loading company details...</Typography>
              )}
            </Box>
          ) : (
            <>
              {(activeTab === 1 && employeeDocuments.length === 0) && (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No employee submitted documents found. Check Employee Management for uploads.
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Company Details Dialog */}
      <Dialog open={openCompanyForm} onClose={() => setOpenCompanyForm(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Company Details</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={companyForm.company_name}
                  onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Company Logo
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<Image />}
                  sx={{ mr: 2 }}
                >
                  Choose Logo
                  <input
                    ref={logoRef}
                    hidden
                    accept="image/*"
                    type="file"
                    onChange={(e) => setCompanyForm({ ...companyForm, logo: e.target.files[0] })}
                  />
                </Button>
                {companyForm.logo && (
                  <Typography variant="caption" color="success.main">
                    {companyForm.logo.name}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Address"
                  multiline
                  rows={3}
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telephone (Landline)"
                  value={companyForm.tel_no}
                  onChange={(e) => setCompanyForm({ ...companyForm, tel_no: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Website URL"
                  value={companyForm.website}
                  onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCompanyForm(false)}>Cancel</Button>
          <Button onClick={async () => {
            try {
              const formData = new FormData();
              if (companyForm.company_name) formData.append('company_name', companyForm.company_name);
              if (companyForm.address) formData.append('address', companyForm.address);
              if (companyForm.tel_no) formData.append('tel_no', companyForm.tel_no);
              if (companyForm.phone) formData.append('phone', companyForm.phone);
              if (companyForm.email) formData.append('email', companyForm.email);
              if (companyForm.website) formData.append('website', companyForm.website);
              if (companyForm.logo) formData.append('logo', companyForm.logo);

              await apiRequest('/organization/companies', {
                method: 'PATCH',
                body: formData,
              });
              setMessage({ type: 'success', text: 'Company details updated successfully!' });
              setOpenCompanyForm(false);
              loadData();
            } catch (error) {
              setMessage({ type: 'error', text: error.message });
            }
          }} variant="contained" endIcon={<Save />}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

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
