import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import employeesRoutes from './routes/employees.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import shiftRoutes from './routes/shift.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import networkRoutes from './routes/network.routes.js';
import holidaysRoutes from './routes/holidays.routes.js';

const app = express();

app.set('trust proxy', true);
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/network-policies', networkRoutes);
app.use('/api/holidays', holidaysRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Attendify backend running on http://localhost:${config.port}`);
});
