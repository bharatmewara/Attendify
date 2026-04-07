# Fix Busboy "Unexpected end of form" Error
## Steps:
- [x] ✅ Create TODO.md (current)
- [ ] ⬇️ Edit backend/src/routes/incentives.routes.js: Replace chained multer.single() with multer.fields()
- [ ] ⬇️ Update req.file access to req.files['screenshot']?.[0] and req.files['kyc_file']?.[0]
- [ ] 🔄 Restart backend server: cd backend && npm run dev
- [ ] 🧪 Test upload from Employee/Incentives.jsx frontend
- [ ] ✅ Verify no other chained .single() in routes
- [ ] 🎉 attempt_completion
