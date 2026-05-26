import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'unsafe-dev-secret',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  email: {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
    port: Number(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587),
    secure: (process.env.EMAIL_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    authUser: process.env.EMAIL_USER || process.env.SMTP_USER,
    authPass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || '"PrimeClick IT" <primeclickit@gmail.com>',
  },
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}
