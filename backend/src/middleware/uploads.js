import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');
const logosDir = path.join(uploadsDir, 'logos');
const kycDir = path.join(uploadsDir, 'kyc');

// Ensure directories exist (called from server.js too)
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
if (!fs.existsSync(kycDir)) fs.mkdirSync(kycDir, { recursive: true });

const companyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'logo') {
      cb(null, logosDir);
    } else if (file.fieldname === 'kyc') {
      cb(null, kycDir);
    } else {
      cb(new Error('Invalid file field - use logo or kyc'));
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const uploadCompany = multer({ 
  storage: companyStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, gif) and PDF allowed'));
    }
  }
});

export { uploadCompany };
