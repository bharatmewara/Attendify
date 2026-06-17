import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Skeleton, TextField, MenuItem, Grid,
} from '@mui/material';
import { Security, Info } from '@mui/icons-material';
import { apiRequest } from '../../../lib/api';

const ACTION_COLORS = {
  cycle_created:     '#6366F1',
  payroll_run:       '#3B82F6',
  payroll_approved:  '#059669',
  payroll_paid:      '#0D9488',
  component_created: '#8B5CF6',
  component_updated: '#F59E0B',
  component_deleted: '#DC2626',
  template_created:  '#EC4899',
  template_updated:  '#F97316',
  assignment_created:'#14B8A6',
  settings_updated:  '#64748B',
  run_item_adjusted: '#EF4444',
};

export default function PayrollAuditLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [action,  setAction]  = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/payroll/audit-logs');
      setLogs(data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = action ? logs.filter(l => l.action === action) : logs;
  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Security sx={{ color: '#6366F1', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0F172A' }}>Payroll Audit Log</Typography>
          <Typography color="text.secondary">Immutable record of all payroll actions</Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <TextField fullWidth select label="Filter by Action" size="small" value={action} onChange={e => setAction(e.target.value)}>
            <MenuItem value="">All Actions</MenuItem>
            {uniqueActions.map(a => <MenuItem key={a} value={a}>{a.replace(/_/g, ' ')}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {loading ? (
            [1,2,3,4,5].map(i => <Skeleton key={i} height={52} sx={{ mb: 1 }} />)
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F8FAFC' } }}>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>IP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>No audit logs found</TableCell>
                    </TableRow>
                  ) : filtered.map(log => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(log.created_at).toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action.replace(/_/g, ' ')}
                          size="small"
                          sx={{
                            fontSize: '0.7rem', fontWeight: 600, borderRadius: 1,
                            bgcolor: `${ACTION_COLORS[log.action] ?? '#6B7280'}15`,
                            color: ACTION_COLORS[log.action] ?? '#6B7280',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {log.entity_type && (
                          <Typography variant="caption">
                            {log.entity_type.replace(/_/g, ' ')} #{log.entity_id}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{log.user_email ?? `User #${log.user_id}`}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{log.ip_address ?? '—'}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
