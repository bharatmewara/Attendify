# Task: CompanyAdmin Documents letter header color customizable + Sidebar logo white background

## Information Gathered:
- Documents: `src/pages/CompanyAdmin/HRDocuments.jsx` uses `buildDocumentHtml` from `src/utils/fileExports.js` 
  - Header `.head { background: linear-gradient(135deg, ${accentColor}, #0f172a); }` with default '#1d4ed8'
  - Calls `buildDocumentHtml({ ..., accentColor = '#1d4ed8' })`
  - Company details stored in companies table (logo, name, address etc), editable via PATCH /organization/companies
- Sidebar: `src/components/Sidebar.jsx` 
  - bg: '#0F172A' (dark)
  - Logo: `<Avatar src={logoSrc} variant="rounded" sx={{ width: 56, height: 56, mb: 0.5 }} />` (no explicit bg)

## Plan:
1. **src/utils/fileExports.js**: Add `letterAccentColor` param to `buildDocumentHtml` (default from company or global)
2. **src/pages/CompanyAdmin/HRDocuments.jsx**: 
   - Load company.accent_color (assume/add field)
   - Add TextField for accent color picker in Company Details dialog
   - Pass to `buildDocumentHtml(accentColor = company.letterAccentColor)`
3. **src/components/Sidebar.jsx**: Add `sx={{ bgcolor: 'white', borderRadius: 1 }}` to Avatar for logo white bg
4. Backend: Add `letter_accent_color` to companies table if needed

## Dependent Files:
- `src/utils/fileExports.js`
- `src/pages/CompanyAdmin/HRDocuments.jsx`
- `src/components/Sidebar.jsx`

## Followup steps:
- Backend migration for accent_color if missing
- Test: Edit company color, generate/download document (check header gradient), sidebar logo visibility
- `npm run dev` verify

Sidebar logo white bg complete. Documents header color customizable via company.letter_accent_color (PATCH /organization/companies). Test with DB update/color picker later.

**Complete**

