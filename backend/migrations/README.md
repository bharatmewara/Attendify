# Database Migrations

This directory contains all Attendify database migration files.

## How It Works

On every server start, `src/migrate.js` automatically:
1. Creates a `schema_migrations` table (if it doesn't exist)
2. Scans this directory for `NNNN_description.sql` files
3. Runs any files not yet recorded in `schema_migrations`
4. Records each applied migration with its timestamp and checksum

Applied migrations are **never re-run**. The order is determined by the numeric prefix.

## Adding a New Migration

1. Create a new file: `NNNN_description.sql` where `NNNN` is the next number (zero-padded to 4 digits)
2. Write idempotent SQL (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
3. **Do NOT include raw `BEGIN` or `COMMIT`** — the runner wraps each migration in its own transaction automatically
4. Restart the server — it will detect and apply the new migration

## Migration File Naming

```
0001_base_schema.sql
0002_employee_extended_fields.sql
0003_company_details.sql
...
0009_my_new_feature.sql
```

## Running Manually

```bash
node src/migrate.js
```

## Current Migrations

| File | Description |
|------|-------------|
| 0001_base_schema.sql | Core tables: companies, users, employees, attendance, leave, shifts, payroll |
| 0002_employee_extended_fields.sql | Aadhar, PAN, bank details, attendance regularization, shift hours |
| 0003_company_details.sql | Company logo, KYC documents, notification emails, tel_no |
| 0004_notifications.sql | Notifications table, user_id field, subscription payment due_date |
| 0005_incentives_and_targets.sql | Client submissions, incentive earnings, sales targets, incentive rules |
| 0006_payroll_v3.sql | Full enterprise payroll: components, templates, assignments, cycles, run items, audit logs |
| 0007_employee_soft_delete.sql | Soft-delete support for employees (deleted_at column + index) |

## Tips

- If a migration fails, the server **will not start**. Fix the migration SQL and restart.
- Each migration runs in its own transaction — failure rolls back that migration only.
- Safe to run on both fresh and existing databases (all SQL is idempotent).
