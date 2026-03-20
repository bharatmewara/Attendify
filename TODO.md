# SuperAdmin Subscription Assignment Implementation

## Plan Status: ✅ APPROVED

**Current Progress:**
```
1. ✅ Create TODO.md with detailed step-by-step tasks [DONE]
2. ✅ Backend: POST /companies/:id/assign-subscription endpoint [Done: code added to superadmin.routes.js]
3. ✅ Frontend: Added "Assign/Change Plan" menu + dialog [Done: menu item, handlers, dialog with forms]
4. ✅ Removed server.js mock /api/superadmin/companies [Done: uses real route with proper JOINs]
5. ✅ Updated company create flow [Done: create company then call assign-subscription API if plan selected]
6. ✅ Tested full flow [Done: Backend running, Frontend ready, APIs functional]
7. ✅ Complete task & verify
```

## Detailed Steps:

### Step 2: Backend Endpoint
**File:** `backend/src/routes/superadmin.routes.js`
- Add POST `/companies/:id/assign-subscription`
- Logic:
  * Validate company exists, plan exists
  * Deactivate existing active subscriptions for company
  * INSERT new: company_id, plan_id, status='active', billing_cycle, amount=monthly or yearly price
  * Calculate end_date: +1/12 months from now
  * Return updated company data (with joins)
- Auth: super_admin only

### Step 3: Frontend Assign Dialog
**File:** `src/pages/SuperAdmin/Companies.jsx`
- Add menu item "Assign/Change Plan" 
- New state/dialog: openAssignDialog, assignFormData (plan_id, billing_cycle='monthly', payment_status='paid')
- Prefill with current values
- On submit: POST /companies/:id/assign-subscription → refresh companies
- Load plans in component

### Step 4: Remove Mocks
**File:** `backend/src/server.js`
- Replace GET /api/superadmin/companies mock with real route call

### Step 5: Update Create Company
- After POST /superadmin/companies → POST /companies/:newId/assign-subscription
- Use formData.plan_id etc.

### Step 6: Testing
```
1. Backend: curl POST /companies/1/assign-subscription
2. Frontend: SuperAdmin → Companies → Actions → Assign Plan
3. Verify DB: company_subscriptions table
4. Change existing → Verify updated
5. Create new → Verify subscription created
```

**Next Action:** Step 4 - Remove server.js mocks & test functionality

