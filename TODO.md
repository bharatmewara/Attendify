# Add Delete Option in Clients Database Table

**Status: In Progress**

## Steps:
- [x] Understand files and create approved plan
- [ ] Create TODO.md with steps
- [x] Edit backend/src/routes/incentives.routes.js: Add DELETE /incentives/clients/:client_key endpoint (admin-only, delete incentive_submission by client_key, sync earnings/payroll)
- [x] Edit src/pages/CompanyAdmin/Clients.jsx: Add Delete button in Actions column, confirmation Dialog, API call, refresh on success
- [x] Test: Add test submission via Employee/Incentives, delete from CompanyAdmin/Clients, verify removal and payroll sync
- [ ] Update TODO.md with completion
- [ ] attempt_completion

**Notes:** Hard delete incentive_submission. Plan approved by user.
