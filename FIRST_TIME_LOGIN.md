# First Time Login Setup

## Step 1: Setup Database

Run this command in your terminal:

```bash
psql -U postgres -d attendify -f backend/sql/schema_complete.sql
```

Or if you need to create the database first:

```bash
createdb attendify
psql -U postgres -d attendify -f backend/sql/schema_complete.sql
```

## Step 2: Start Backend Server

```bash
cd backend
npm run dev
```

Backend should be running on: http://localhost:4000

## Step 3: Start Frontend

In a new terminal:

```bash
npm run dev
```

Frontend should be running on: http://localhost:5173

## Step 4: Login

### Super Admin Login
- URL: http://localhost:5173/auth/login
- Email: `superadmin@attendify.com`
- Password: `admin123`

### Company Admin Login
- URL: http://localhost:5173/auth/login
- Email: `admin@demotech.com`
- Password: `admin123`

## Troubleshooting

### If login fails:
1. Check backend is running on port 4000
2. Check database connection in backend/.env
3. Verify schema was loaded: `psql -U postgres -d attendify -c "SELECT * FROM users;"`

### If "Employee profile not found" error:
This is normal for super_admin - they don't have employee profiles.
Company admins and employees need employee records.

## Next Steps After Login

### As Super Admin:
- View platform analytics
- Manage companies
- Create subscription plans

### As Company Admin:
- Add employees
- Configure departments
- Setup shifts
- Manage attendance

Enjoy Attendify! 🚀
