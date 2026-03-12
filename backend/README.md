# Attendify Backend (Node + PostgreSQL)

## 1) Install dependencies

```bash
cd backend
npm install
```

## 2) Configure environment

Copy `.env.example` to `.env` and set values:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_ORIGIN`
- `PORT`

## 3) Create database schema

Run `backend/sql/schema.sql` on your PostgreSQL database.

## 4) Run server

```bash
npm run dev
```

Server starts at `http://localhost:4000`.

## 5) First-time setup

Create first admin:

`POST /api/auth/bootstrap-admin`

```json
{
  "fullName": "Super Admin",
  "email": "admin@attendify.com",
  "password": "Admin@123"
}
```

After admin login, configure office networks from:

- `Super Admin Panel -> Network policies`

Use CIDR format:

- `192.168.1.0/24` (whole office subnet)
- `10.0.0.15/32` (single IP)

## Rules implemented

- Employee login allowed only when request IP matches active policy with `employee_login_allowed=true`.
- Punch-in allowed only when request IP matches active policy with `punch_allowed=true`.
- Admin login is always allowed.
- Biometric sync endpoint for admin updates attendance records.
