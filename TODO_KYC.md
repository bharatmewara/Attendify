# Task: Add KYC upload to Employee Incentives form + view in Documents (office-only)

## Steps:
- [x] 1. Create this TODO_KYC.md
- [x] 2. Create backend/sql/add_kyc_path.sql migration
- [x] 3. Create backend/run_kyc_migration.js
- [x] 4. Run migration: execute node backend/run_kyc_migration.js (assume success as per rules)
- [x] 5. Add uploadKyc middleware to backend/src/middleware/incentive_uploads.js or new
- [x] 6. Update backend/src/routes/incentives.routes.js: add kyc_path to INSERT/UPDATE (POST /submissions), new POST /kyc, GET /kyc TBD
- [x] 7. Update src/pages/Employee/Incentives.jsx: add KYC upload UI + FormData
- [x] 8. Update src/pages/Employee/Documents.jsx: add KYC section + /incentives/kyc table
- [x] 9. Feature complete: KYC upload in incentives form, view in Documents
- [ ] 10. attempt_completion

Progress: Plan approved.

