# Attendify Backend - SaaS HRMS Platform

## Overview
Complete multi-tenant SaaS HRMS backend with support for:
- Super Admin (Platform Owner)
- Company Admin (HR Management)
- Employee (Self-Service Portal)

## Features Implemented

### 1. Multi-Tenant Architecture
- Complete data isolation between companies
- Tenant-aware middleware
- Company-specific configurations

### 2. Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password encryption with bcrypt
- Audit logging for all activities

### 3. Modules

#### Super Admin Panel
- Company management (CRUD)
- Subscription plan management
- Payment tracking
- Platform analytics
- System monitoring

#### Employee Management
- Employee CRUD operations
- Employee documents
- Asset management
- Department & designation management

#### Attendance Management
- Punch in/out system
- Late arrival tracking
- Early leave tracking
- Shift-based calculations
- Attendance reports

#### Leave Management
- Leave types configuration
- Leave balance tracking
- Leave request workflow
- Multi-level approval
- Automatic balance updates

#### Shift Management
- Multiple shift support
- Shift assignment to employees
- Grace period configuration
- Penalty calculations

#### Payroll Management
- Salary structure management
- Automatic payroll calculation
- Attendance integration
- Leave integration
- Payslip generation

#### HR Documents
- Offer letter generation
- Appointment letter generation
- Agreement templates
- Document history

## Database Setup

### 1. Create Database
```bash
createdb attendify
```

### 2. Run Schema
```bash
psql -U postgres -d attendify -f backend/sql/schema_complete.sql
```

## Environment Variables

Create `.env` file:
```
PORT=4000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/attendify
JWT_SECRET=your_strong_secret_key_here
CLIENT_ORIGIN=http://localhost:5173
```

## Installation

```bash
cd backend
npm install
```

## Running the Server

```bash
npm run dev
```

Server will run on http://localhost:4000

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Super Admin
- `GET /api/superadmin/companies` - Get all companies
- `POST /api/superadmin/companies` - Create company
- `PUT /api/superadmin/companies/:id` - Update company
- `GET /api/superadmin/subscription-plans` - Get plans
- `POST /api/superadmin/subscription-plans` - Create plan
- `GET /api/superadmin/analytics` - Platform analytics
- `GET /api/superadmin/payments` - Payment history

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `GET /api/employees/:id/documents` - Get employee documents
- `GET /api/employees/:id/assets` - Get employee assets
- `POST /api/employees/:id/assets` - Assign asset

### Attendance
- `POST /api/attendance/punch-in` - Punch in
- `POST /api/attendance/punch-out` - Punch out
- `GET /api/attendance/today` - Today's status
- `GET /api/attendance/records` - Get attendance records
- `POST /api/attendance/mark-absent` - Mark absent (admin)
- `GET /api/attendance/summary` - Attendance summary

### Leave
- `GET /api/leave/types` - Get leave types
- `POST /api/leave/types` - Create leave type
- `GET /api/leave/requests` - Get leave requests
- `POST /api/leave/requests` - Apply for leave
- `PUT /api/leave/requests/:id` - Approve/reject leave
- `GET /api/leave/balance` - Get leave balance
- `GET /api/leave/balance/:employeeId` - Get employee balance

### Shifts
- `GET /api/shifts` - Get all shifts
- `POST /api/shifts` - Create shift
- `PUT /api/shifts/:id` - Update shift
- `POST /api/shifts/assign` - Assign shift to employee
- `GET /api/shifts/employee/:employeeId` - Get employee shift

### Payroll
- `GET /api/payroll/salary-structure/:employeeId` - Get salary structure
- `POST /api/payroll/salary-structure` - Create salary structure
- `POST /api/payroll/calculate` - Calculate payroll
- `GET /api/payroll/records` - Get payroll records
- `GET /api/payroll/payslips` - Get payslips
- `POST /api/payroll/payslips/:payrollId` - Generate payslip

### HR Documents
- `GET /api/documents` - Get HR documents
- `POST /api/documents` - Generate document
- `GET /api/documents/templates` - Get templates

### Organization
- `GET /api/organization/departments` - Get departments
- `POST /api/organization/departments` - Create department
- `PUT /api/organization/departments/:id` - Update department
- `GET /api/organization/designations` - Get designations
- `POST /api/organization/designations` - Create designation
- `PUT /api/organization/designations/:id` - Update designation

## Default Credentials

### Super Admin
- Email: superadmin@attendify.com
- Password: admin123

### Demo Company Admin
- Email: admin@demotech.com
- Password: admin123

## Security Features
- JWT token authentication
- Password hashing with bcrypt
- Role-based access control
- Tenant isolation middleware
- Audit logging
- SQL injection prevention (parameterized queries)

## Tech Stack
- Node.js
- Express.js
- PostgreSQL
- JWT
- bcryptjs

## Project Structure
```
backend/
├── sql/
│   └── schema_complete.sql
├── src/
│   ├── middleware/
│   │   └── auth.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── superadmin.routes.js
│   │   ├── employees.routes.js
│   │   ├── attendance.routes.js
│   │   ├── leave.routes.js
│   │   ├── shift.routes.js
│   │   ├── payroll.routes.js
│   │   ├── documents.routes.js
│   │   └── organization.routes.js
│   ├── utils/
│   │   └── audit.js
│   ├── config.js
│   ├── db.js
│   └── server.js
├── .env
├── .env.example
└── package.json
```

## Next Steps
1. Run database schema
2. Configure environment variables
3. Start the server
4. Test with default credentials
5. Build frontend integration
