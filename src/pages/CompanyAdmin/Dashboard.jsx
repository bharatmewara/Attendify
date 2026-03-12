import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  People,
  CheckCircle,
  Cancel,
  EventAvailable,
  AttachMoney,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';

export default function CompanyAdminDashboard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const loadData = async () => {
    try {
      const [employeesData, attendanceData, leaveData] = await Promise.all([
        apiRequest('/employees'),
        apiRequest('/attendance/summary'),
        apiRequest('/leave/requests?status=pending'),
      ]);
      setEmployees(employeesData);
      setAttendance(attendanceData);
      setLeaveRequests(leaveData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const statCards = [
    {
      title: 'Total Employees',
      value: employees.length,
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#1976d2',
    },
    {
      title: 'Present Today',
      value: attendance?.present_count || 0,
      icon: <CheckCircle sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
    },
    {
      title: 'Absent Today',
      value: attendance?.absent_count || 0,
      icon: <Cancel sx={{ fontSize: 40 }} />,
      color: '#d32f2f',
    },
    {
      title: 'Pending Leaves',
      value: leaveRequests.length,
      icon: <EventAvailable sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Company Dashboard</Typography>
        <Button variant="contained" onClick={() => navigate('/app/employees')}>
          Add Employee
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {stat.title}
                    </Typography>
                    <Typography variant="h4">{stat.value}</Typography>
                  </Box>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Employees
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employees.slice(0, 5).map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell>{`${emp.first_name} ${emp.last_name}`}</TableCell>
                        <TableCell>{emp.employee_code}</TableCell>
                        <TableCell>{emp.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={emp.is_active ? 'Active' : 'Inactive'}
                            color={emp.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Pending Leave Requests
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Days</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaveRequests.slice(0, 5).map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell>{`${leave.first_name} ${leave.last_name}`}</TableCell>
                        <TableCell>{leave.leave_type_name}</TableCell>
                        <TableCell>{leave.total_days}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => navigate('/app/leave')}>
                            Review
                          </Button>
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
