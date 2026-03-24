import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');
const incentivesDir = path.join(uploadsDir, 'incentives');

// Ensure directories exist
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(incentivesDir)) fs.mkdirSync(incentivesDir, { recursive: true });

const incentiveStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, incentivesDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const uploadIncentiveScreenshot = multer({ 
  storage: incentiveStorage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png, gif) are allowed'));
    }
  }
});

export { uploadIncentiveScreenshot };
