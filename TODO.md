# Fix: Documents Submitted but Not Visible in Company Admin Panel

## Status: ✅ Backend complete (new /employees/documents + profile fix)

### 1. Backend Updates 
   - ✅ Add GET /employees/documents route in employees.routes.js (company-wide employee_documents list)
   - ✅ Fix /:id/profile query to fetch employee_documents instead of hr_documents

### 2. Frontend HRDocuments.jsx Updates [IN PROGRESS]
   - [ ] Add Tabs (HR Generated | Employee Submitted)
   - [ ] New tab fetches /employees/documents
   - [ ] Display table with Employee, Doc Name, Type, Upload Date, Download

### 3. EmployeeManagement Profile Fix
   - [ ] Update Documents tab to show correct data from fixed profile API (minor UI if needed)

### 4. Testing
   - [ ] Backend restart & test endpoints (`npx kill-port 4000 && cd backend && npm run dev`)
   - [ ] Frontend dev server (`npm run dev`)
   - [ ] Test: Insert sample employee_document, verify in HRDocuments + profile
   - [ ] attempt_completion

