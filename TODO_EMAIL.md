# Task: Add Regards footer to every mail

## Information Gathered:
- Emails in `backend/src/utils/email.js` (nodemailer)
- Main locations:
  - `backend/src/routes/incentives.routes.js` : submission emails
  - `backend/src/routes/leave.routes.js` : leave notifications
  - `backend/src/routes/employees.routes.js` : onboarding
  - `backend/src/routes/documents.routes.js` : few

## Plan:
**Dynamic**: Load company from DB, append `\n\nRegards\n{company.company_name}\n{company.phone}` to text (similar for HTML)

Files:
1. `backend/src/utils/email.js`: New `sendEmailWithRegards(companyId, {to, subject, text, html})`
2. Replace sendEmail calls with sendEmailWithRegards

## Dependent Files:
- backend/src/utils/email.js
- backend/src/routes/incentives.routes.js (main)
- backend/src/routes/leave.routes.js
- backend/src/routes/employees.routes.js

## Followup:
- Backend restart
- Test mail sends

Updated sendEmail to append company-specific Regards footer when companyId passed (DB lookup company_name/phone).

All calls using sendEmail({..., companyId: req.companyId}) will get footer.

**Complete** (manual update calls if needed)

