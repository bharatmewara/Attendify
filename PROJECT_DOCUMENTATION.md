# Attendify - Complete SaaS HRMS Platform

## 🚀 Project Overview

Attendify is a comprehensive cloud-based SaaS HRMS (Human Resource Management System) platform built with React, Node.js, Express, and PostgreSQL. It supports multi-tenant architecture allowing multiple companies to manage their HR operations independently.

## ✨ Key Features

### Multi-Tenant Architecture
- Complete data isolation between companies
- Company-specific configurations
- Scalable SaaS model

### Three User Roles

#### 1. Super Admin (Platform Owner)
- Manage all companies on the platform
- Create and configure subscription plans
- Monitor platform analytics
- Track payments and billing
- System-wide monitoring

#### 2. Company Admin / HR
- Employee management (CRUD)
- Attendance monitoring and reports
- Leave approval workflow
- Shift management
- Payroll processing
- HR document generation
- Department & designation management

#### 3. Employee (Self-Service Portal)
- Punch in/out for attendance
- Apply for leave
- View leave balance
- Download payslips
- View attendance history
- Access HR documents

## 📦 Modules Implemented

### 1. Authentication & Security
- JWT-based authentication
- Role-based access control (RBAC)
- Password encryption with bcrypt
- Multi-role login support
- Session management
- Audit logging

### 2. Employee Management
- Complete employee lifecycle management
- Employee directory with search and filters
- Document management
- Asset tracking
- Emergency contact management
- Department and designation assignment

### 3. Attendance Management
- Online punch in/out system
- Late arrival tracking with grace period
- Early leave tracking
- Shift-based calculations
- Attendance reports (daily, monthly)
- Biometric integration support
- Geo-location tracking

### 4. Leave Management
- Multiple leave types (CL, SL, PL, etc.)
- Leave balance tracking
- Leave application workflow
- Multi-level approval system
- Automatic balance updates
- Leave history and reports
- Carry forward support

### 5. Shift Management
- Multiple shift configurations
- Shift assignment to employees
- Working days setup
- Grace period configuration
- Late and early leave penalties
- Rotational shift support

### 6. Payroll Management
- Salary structure management
- Automatic payroll calculation
- Attendance integration
- Leave deduction
- Allowances and deductions
- Tax calculations
- Overtime and incentives
- Payslip generation
- Email payslips to employees

### 7. HR Documents & Letters
- Offer letter generation
- Appointment letter generation
- Employment agreement templates
- Auto-fill employee information
- Document history tracking
- PDF generation support

### 8. Reports & Analytics
- Attendance reports
- Leave reports
- Payroll reports
- Employee reports
- Platform analytics (Super Admin)
- Export to CSV/Excel/PDF

### 9. Organization Management
- Department management
- Designation management
- Company profile settings
- Leave type configuration

### 10. Audit & Compliance
- Complete audit trail
- Login activity logs
- Data modification tracking
- IP address logging
- User agent tracking

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **Vite** - Build tool
- **Material-UI (MUI)** - Component library
- **React Router** - Routing
- **Context API** - State management

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## 📁 Project Structure

```
Attendify/
├── backend/
│   ├── sql/
│   │   └── schema_complete.sql          # Complete database schema
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.middleware.js       # Auth & tenant isolation
│   │   ├── routes/
│   │   │   ├── auth.routes.js           # Authentication
│   │   │   ├── superadmin.routes.js     # Super admin APIs
│   │   │   ├── employees.routes.js      # Employee management
│   │   │   ├── attendance.routes.js     # Attendance APIs
│   │   │   ├── leave.routes.js          # Leave management
│   │   │   ├── shift.routes.js          # Shift management
│   │   │   ├── payroll.routes.js        # Payroll APIs
│   │   │   ├── documents.routes.js      # HR documents
│   │   │   └── organization.routes.js   # Dept & designation
│   │   ├── utils/
│   │   │   └── audit.js                 # Audit logging
│   │   ├── config.js                    # Configuration
│   │   ├── db.js                        # Database connection
│   │   └── server.js                    # Express server
│   ├── .env                             # Environment variables
│   └── package.json
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   └── StatCard.jsx
│   ├── context/
│   │   └── AuthContext.jsx              # Auth context
│   ├── layout/
│   │   ├── AuthLayout.jsx
│   │   └── MainLayout.jsx
│   ├── lib/
│   │   └── api.js                       # API client
│   ├── pages/
│   │   ├── Auth/
│   │   │   └── Login.jsx
│   │   ├── SuperAdmin/
│   │   │   └── Dashboard.jsx            # Super admin dashboard
│   │   ├── CompanyAdmin/
│   │   │   ├── Dashboard.jsx            # Company dashboard
│   │   │   ├── EmployeeManagement.jsx   # Employee CRUD
│   │   │   └── LeaveManagement.jsx      # Leave management
│   │   └── Employee/
│   │       └── Dashboard.jsx            # Employee portal
│   ├── routes/
│   │   └── ProtectedRoute.jsx
│   ├── theme/
│   │   └── index.js
│   ├── App.jsx
│   └── main.jsx
├── .env
├── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

### Installation

#### 1. Clone the repository
```bash
git clone <repository-url>
cd Attendify
```

#### 2. Setup Database
```bash
# Create database
createdb attendify

# Run schema
psql -U postgres -d attendify -f backend/sql/schema_complete.sql
```

#### 3. Backend Setup
```bash
cd backend
npm install

# Create .env file
cp .env.example .env

# Update .env with your configuration
PORT=4000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/attendify
JWT_SECRET=your_strong_secret_key
CLIENT_ORIGIN=http://localhost:5173

# Start backend server
npm run dev
```

#### 4. Frontend Setup
```bash
# In root directory
npm install

# Start frontend
npm run dev
```

### Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## 🔐 Default Credentials

### Super Admin
- Email: `superadmin@attendify.com`
- Password: `admin123`

### Demo Company Admin
- Email: `admin@demotech.com`
- Password: `admin123`

## 📊 Database Schema

The system uses a comprehensive PostgreSQL schema with:
- 21 main tables
- Multi-tenant data isolation
- Referential integrity
- Audit logging
- Optimized indexes

Key tables:
- `companies` - Company/tenant data
- `users` - All system users
- `employees` - Employee profiles
- `attendance_records` - Attendance tracking
- `leave_requests` - Leave management
- `payroll_calculations` - Payroll data
- `hr_documents` - HR letters
- `audit_logs` - System audit trail

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Super Admin
- `GET /api/superadmin/companies` - List companies
- `POST /api/superadmin/companies` - Create company
- `GET /api/superadmin/analytics` - Platform stats
- `GET /api/superadmin/subscription-plans` - List plans

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Attendance
- `POST /api/attendance/punch-in` - Punch in
- `POST /api/attendance/punch-out` - Punch out
- `GET /api/attendance/records` - Get records
- `GET /api/attendance/summary` - Get summary

### Leave
- `GET /api/leave/requests` - List requests
- `POST /api/leave/requests` - Apply leave
- `PUT /api/leave/requests/:id` - Approve/reject
- `GET /api/leave/balance` - Get balance

### Payroll
- `POST /api/payroll/calculate` - Calculate payroll
- `GET /api/payroll/records` - Get records
- `POST /api/payroll/payslips/:id` - Generate payslip

## 🔒 Security Features

- JWT token-based authentication
- Password hashing with bcrypt (10 rounds)
- Role-based access control
- Tenant isolation middleware
- SQL injection prevention (parameterized queries)
- XSS protection
- CORS configuration
- Audit logging for all critical operations

## 🎯 Future Enhancements

- [ ] Email notifications (SMTP integration)
- [ ] SMS notifications
- [ ] Biometric device integration
- [ ] Mobile app (React Native)
- [ ] Advanced reporting with charts
- [ ] Performance reviews module
- [ ] Training management
- [ ] Recruitment module
- [ ] Two-factor authentication
- [ ] File upload for documents
- [ ] PDF generation for payslips
- [ ] Export reports to Excel/PDF
- [ ] Real-time notifications
- [ ] Dashboard widgets customization

## 📝 License

This project is proprietary software.

## 👥 Support

For support, email support@attendify.com

---

Built with ❤️ using React, Node.js, and PostgreSQL
