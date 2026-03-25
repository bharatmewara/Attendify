import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.auth = decoded;

    const result = await query(
      `SELECT u.*, COALESCE(e.company_id, u.company_id) AS company_id
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = result.rows[0];
    if (!req.user.company_id && decoded.companyId) {
      req.user.company_id = decoded.companyId;
    }
    if (!req.user.role && decoded.role) {
      req.user.role = decoded.role;
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    next();
  };
};

export const tenantIsolation = (req, res, next) => {
  const requestedCompanyId = Number(
    req.query.company_id || req.body?.company_id || req.headers['x-company-id'] || 0
  );

  if (req.user.role === 'super_admin') {
    req.companyId = requestedCompanyId || null;
    req.allowAllCompanies = !req.companyId;
    return next();
  }

  const derivedCompanyId =
    req.user.company_id ||
    req.auth?.companyId ||
    ((req.user.role === 'company_admin' || req.user.role === 'super_admin') ? requestedCompanyId : null);

  if (!derivedCompanyId) {
    if (req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employee user must be associated with a company.' });
    }
    return res.status(403).json({ message: 'No company association' });
  }

  req.companyId = Number(derivedCompanyId);
  req.allowAllCompanies = false;
  next();
};

export const requireCompanyContext = (req, res, next) => {
  if (!req.companyId) {
    return res.status(400).json({ message: 'company_id is required for this action' });
  }
  return next();
};
