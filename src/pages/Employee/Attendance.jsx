import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Download, CalendarMonth } from '@mui/icons-material';
import { apiRequest } from '../../lib/api';

const EXPECTED_HOURS = 9;

const shellCardSx = {
  borderRadius: 3,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
};

export default function EmployeeAttendance() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startRecord = new Date(year, month - 1, 1).toLocaleDateString('en-CA');
      const endRecord = new Date(year, month, 0).toLocaleDateString('en-CA');

      const res = await apiRequest(`/attendance/records?start_date=${startRecord}&end_date=${endRecord}`);
      setRecords(res || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDownload = () => {
    const headers = ['Date', 'Status', 'Punch In', 'Punch Out', 'Total Hours', 'Plus/Minus Hours'];
    const csvContent = [
      headers.join(','),
      ...records.map((r) => {
        const punchIn = r.punch_in_time ? new Date(r.punch_in_time).toLocaleTimeString() : '-';
        const punchOut = r.punch_out_time ? new Date(r.punch_out_time).toLocaleTimeString() : '-';
        const total = r.total_hours ? Number(r.total_hours).toFixed(2) : '0.00';
        const diff = r.total_hours ? (Number(r.total_hours) - EXPECTED_HOURS).toFixed(2) : '-';
        return `${new Date(r.work_date).toLocaleDateString()},${r.status},${punchIn},${punchOut},${total},${diff}`;
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${currentMonth.getFullYear()}_${currentMonth.getMonth() + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }).map((_, i) => null);
    const daysArr = Array.from({ length: daysInMonth }).map((_, i) => new Date(year, month, i + 1));
    
    return [...blanks, ...daysArr];
  }, [currentMonth]);

  // Removed week chunking to use native CSS Grid with 7 columns instead

  const getRecordForDate = (date) => {
    if (!date) return null;
    const dateStr = date.toLocaleDateString('en-CA');
    return records.find(r => r.work_date.split('T')[0] === dateStr || new Date(r.work_date).toLocaleDateString('en-CA') === dateStr);
  };

  const selectedRecord = getRecordForDate(new Date(selectedDate));

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>My Attendance</Typography>
          <Typography color="text.secondary">View your daily time logs, total hours, and variations.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Download />} onClick={handleDownload} sx={{ bgcolor: '#4f46e5', '&:hover': { bgcolor: '#4338ca' } }}>
          Download Sheet
        </Button>
      </Box>

      <Grid container spacing={4}>
        {/* Full Width Calendar */}
        <Grid item xs={12}>
          <Card sx={{ ...shellCardSx, overflow: 'visible', width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={handlePrevMonth}><ChevronLeft /></IconButton>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </Typography>
                <IconButton onClick={handleNextMonth}><ChevronRight /></IconButton>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 1, md: 1.5 } }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <Box key={day} sx={{ textAlign: 'center', py: 1.5, bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>{day}</Typography>
                  </Box>
                ))}
                {days.map((day, idx) => {
                  if (!day) return (
                    <Box key={`blank-${idx}`} sx={{
                      minHeight: { xs: 80, md: 100 },
                      bgcolor: 'rgba(0,0,0,0.015)',
                      border: '1px dashed rgba(0,0,0,0.08)',
                      borderRadius: 3
                    }} />
                  );
                  
                  const dateStr = day.toLocaleDateString('en-CA');
                  const isSelected = selectedDate === dateStr;
                  const isToday = new Date().toLocaleDateString('en-CA') === dateStr;
                  const record = getRecordForDate(day);
                  
                  let bgcolor = '#fff';
                  let borderColor = 'rgba(0,0,0,0.08)';
                  let headerColor = 'text.primary';
                  
                  if (isSelected) {
                    borderColor = '#4f46e5';
                    bgcolor = 'rgba(79, 70, 229, 0.04)';
                  } else if (record) {
                    if (record.status === 'present') bgcolor = '#f0fdf4';
                    if (record.status === 'absent') bgcolor = '#fef2f2';
                    if (record.status === 'on_leave') bgcolor = '#fffbeb';
                  }

                  return (
                    <Box
                      key={idx}
                      onClick={() => setSelectedDate(dateStr)}
                      sx={{
                        minHeight: { xs: 80, md: 100 },
                        p: { xs: 0.75, md: 1.25 },
                        borderRadius: 3,
                        cursor: 'pointer',
                        bgcolor,
                        border: `2px solid ${borderColor}`,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': { 
                          borderColor: isSelected ? '#3730a3' : '#a5b4fc',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ 
                          fontWeight: isToday ? 800 : (isSelected ? 700 : 600),
                          color: isToday ? '#fff' : headerColor,
                          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%', bgcolor: isToday ? '#4f46e5' : (isSelected ? 'rgba(79,70,229,0.1)' : 'transparent')
                        }}>
                          {day.getDate()}
                        </Typography>
                        {record && (
                          <Chip 
                            size="small" 
                            label={record.status === 'present' ? 'P' : record.status === 'absent' ? 'A' : 'L'} 
                            color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'warning'}
                            sx={{ height: 20, minWidth: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' }, fontWeight: 800 }}
                          />
                        )}
                      </Box>

                      {record && record.punch_in_time && (
                        <Box sx={{ mt: 'auto', display: { xs: 'none', md: 'block' } }}>
                          <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem', mb: 0.25 }}>
                            <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>In:</Box>
                            {new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                          {record.punch_out_time && (
                            <Typography variant="caption" sx={{ display: 'flex', justifyContent: 'space-between', color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                              <Box component="span" sx={{ color: 'error.main', fontWeight: 700 }}>Out:</Box>
                              {new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          )}
                          {record.total_hours && (
                            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', color: 'text.primary', fontWeight: 800, mt: 0.5, fontSize: '0.7rem' }}>
                              {Number(record.total_hours).toFixed(2)}h
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Selected Date Details */}
        <Grid item xs={12}>
          <Card sx={{ ...shellCardSx, bgcolor: '#f8fafc', width: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{new Date(selectedDate).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}</Typography>
              
              {!selectedRecord ? (
                <Typography color="text.secondary">No attendance record found for this date.</Typography>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>Status</Typography>
                      <Chip label={selectedRecord.status} size="small" color={selectedRecord.status === 'present' ? 'success' : selectedRecord.status === 'absent' ? 'error' : 'warning'} sx={{ textTransform: 'capitalize', fontWeight: 600 }} />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>Punch In</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{selectedRecord.punch_in_time ? new Date(selectedRecord.punch_in_time).toLocaleTimeString() : '-'}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>Punch Out</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{selectedRecord.punch_out_time ? new Date(selectedRecord.punch_out_time).toLocaleTimeString() : '-'}</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>Total Hours</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{selectedRecord.total_hours ? Number(selectedRecord.total_hours).toFixed(2) : '-'} hrs</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 2 }}>
                      <Typography color="text.secondary" variant="body2" sx={{ mb: 0.5 }}>Plus/Minus</Typography>
                      <Typography sx={{ fontWeight: 800, color: selectedRecord.total_hours && (Number(selectedRecord.total_hours) - EXPECTED_HOURS) < 0 ? 'error.main' : 'success.main' }}>
                        {selectedRecord.total_hours ? (Number(selectedRecord.total_hours) - EXPECTED_HOURS > 0 ? '+' : '') + (Number(selectedRecord.total_hours) - EXPECTED_HOURS).toFixed(2) : '-'} hrs
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Attendance Sheet List */}
        <Grid item xs={12}>
          <Card sx={{ ...shellCardSx, height: '100%', width: '100%' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Attendance Sheet</Typography>
              </Box>
              <TableContainer component={Paper} elevation={0} sx={{ width: '100%' }}>
                <Table sx={{ width: '100%' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Punch In</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Punch Out</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>+/- Hrs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.length > 0 ? records.map((record) => {
                      const dateObj = new Date(record.work_date);
                      const isMinus = record.total_hours && (Number(record.total_hours) - EXPECTED_HOURS) < 0;
                      return (
                        <TableRow key={record.id} hover onClick={() => setSelectedDate(dateObj.toLocaleDateString('en-CA'))} sx={{ cursor: 'pointer' }}>
                          <TableCell sx={{ fontWeight: 500 }}>{dateObj.toLocaleDateString('en-GB')}</TableCell>
                          <TableCell>
                            <Chip label={record.status} size="small" color={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'warning'} sx={{ textTransform: 'capitalize', fontWeight: 600, height: 24 }} />
                          </TableCell>
                          <TableCell>{record.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell>{record.punch_out_time ? new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{record.total_hours ? `${Number(record.total_hours).toFixed(2)}` : '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: isMinus ? 'error.main' : 'success.main' }}>
                            {record.total_hours ? `${(Number(record.total_hours) - EXPECTED_HOURS > 0 ? '+' : '')}${(Number(record.total_hours) - EXPECTED_HOURS).toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                          <Typography color="text.secondary">No attendance records found for this month.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
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
