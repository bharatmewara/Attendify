import { useEffect, useState } from 'react';
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
import { API_BASE_URL, apiRequest } from '../../lib/api';
import { buildDocumentHtml, fetchImageAsDataUrl } from '../../utils/fileExports';

export default function EmployeeDocuments() {
  const [documents, setDocuments] = useState([]);
  const [company, setCompany] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleOpenDocument = async (doc) => {
    if (!doc) return;
    if (doc.document_url && /^https?:\/\//i.test(doc.document_url)) {
      window.open(doc.document_url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Fallback for generated docs: render stored content as branded HTML in a new tab.
    if (doc.content) {
      const apiOrigin = API_BASE_URL.replace(/\/api$/, '');
      const rawLogo = company?.logo
        ? (company.logo.startsWith('http') ? company.logo : `${apiOrigin}${company.logo}`)
        : null;
      const logoDataUrl = rawLogo ? await fetchImageAsDataUrl(rawLogo) : null;
      const html = buildDocumentHtml({
        title: doc.title || 'Document',
        employeeName: '',
        companyName: company?.company_name || 'Attendify',
        companyLogo: logoDataUrl,
        companyAddress: company?.address || '',
        companyPhone: company?.phone || '',
        companyTel: company?.tel_no || '',
        companyEmail: company?.email || '',
        companyWebsite: company?.website || '',
        content: doc.content,
      });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    setMessage({ type: 'info', text: 'No previewable file is available for this document.' });
  };

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest('/documents');
        const companyData = await apiRequest('/organization/companies');
        setDocuments(data || []);
        setCompany(companyData || null);
      } catch (error) {
        setMessage({ type: 'error', text: error.message });
      }
    };
    load();
  }, []);

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        {message.text ? <Alert severity={message.type || 'info'}>{message.text}</Alert> : null}

        <Card>
          <CardContent>
        <Typography variant="h5" fontWeight={800}>My Documents</Typography>
        <Typography color="text.secondary">Payroll docs and KYC submissions.</Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Preview</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.length ? (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell><Chip size="small" label={doc.document_type} /></TableCell>
                        <TableCell>{doc.title || '-'}</TableCell>
                        <TableCell>{doc.generated_at ? new Date(doc.generated_at).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{doc.content ? `${doc.content.slice(0, 120)}...` : '-'}</TableCell>
                        <TableCell align="right">
                          {doc.document_url || doc.content ? (
                            <Button size="small" onClick={() => handleOpenDocument(doc)}>Open</Button>
                          ) : (
                            <Typography variant="body2" color="text.secondary">N/A</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
<TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        No documents found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
