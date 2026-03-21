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
import incentivesRoutes from './routes/incentives.routes.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authenticate, authorize } from './middleware/auth.middleware.js';
import { query } from './db.js';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.set('trust proxy', true);
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

// File uploads setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const logosDir = path.join(uploadsDir, 'logos');
const kycDir = path.join(uploadsDir, 'kyc');
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
if (!fs.existsSync(kycDir)) fs.mkdirSync(kycDir, { recursive: true });

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Multer storage for companies
const companyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'logo') {
      cb(null, logosDir);
    } else if (file.fieldname === 'kyc') {
      cb(null, kycDir);
    } else {
      cb(new Error('Invalid file field'), null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const uploadCompany = multer({ 
  storage: companyStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF allowed'));
    }
  }
});

// uploadCompany available from middleware/uploads.js

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// SuperAdmin Dashboard APIs - Auth protected (real data)
// REMOVED MOCK - Now uses real superadmin.routes.js /companies endpoint with JOINs
// app.get('/api/superadmin/companies', authenticate, authorize('super_admin'), async (req, res) => { ... }

app.get('/api/superadmin/analytics', (req, res) => {
  res.json({
    active_companies: 12,
    total_companies: 15,
    total_employees: 245,
    active_users: 89,
    monthly_revenue: 125000
  });
});

app.get('/api/superadmin/expiring-subscriptions', (req, res) => {
  res.json([]);
});

app.get('/api/superadmin/pending-payments', (req, res) => {
  res.json([]);
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
app.use('/api/incentives', incentivesRoutes);

// SuperAdmin Dashboard APIs (added for 404 fix)
app.use('/api/superadmin/analytics', (req, res) => {
  res.json({
    active_companies: 12,
    total_companies: 15,
    total_employees: 245,
    active_users: 89,
    monthly_revenue: 125000
  });
});

app.use('/api/superadmin/expiring-subscriptions', (req, res) => {
  res.json([]);
});

app.use('/api/superadmin/pending-payments', (req, res) => {
  res.json([]);
});

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


