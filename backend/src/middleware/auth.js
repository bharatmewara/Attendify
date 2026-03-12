import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export const authRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userResult = await query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1 LIMIT 1',
      [payload.userId],
    );
    const user = userResult.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid user' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
};
