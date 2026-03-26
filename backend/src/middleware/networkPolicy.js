import { query } from '../db.js';
import { getClientIp } from '../utils/network.js';

export const isCompanyIpAllowedByPolicy = async (companyId, ip, policyField) => {
  try {
    // If no network policies exist for the company, allow access
    const policiesExist = await query(
      `SELECT COUNT(*) as count FROM network_policies WHERE company_id = $1 AND is_active = TRUE`,
      [companyId]
    );

    if (policiesExist.rows[0].count === '0') {
      return true; // No policies configured, allow access
    }

    // Check if IP matches any policy
    const result = await query(
      `SELECT id
       FROM network_policies
       WHERE is_active = TRUE
         AND company_id = $2
         AND ${policyField} = TRUE
         AND $1::inet <<= network_cidr
       LIMIT 1`,
      [ip, companyId],
    );

    return Boolean(result.rows[0]);
  } catch (error) {
    console.error('Network policy check error:', error);
    // On error, allow access to prevent blocking legitimate users
    return true;
  }
};

export const enforceEmployeeLoginIp = async (req, res, next) => {
  if (!req.user?.company_id) {
    return next();
  }
  const ip = getClientIp(req);
  const allowed = await isCompanyIpAllowedByPolicy(req.user.company_id, ip, 'employee_login_allowed');
  if (!allowed) {
    return res.status(403).json({
      message: 'Login is blocked for this network. Contact admin.',
      ip,
    });
  }
  return next();
};

export const enforcePunchIp = async (req, res, next) => {
  if (!req.companyId) {
    return next();
  }
  const ip = getClientIp(req);
  const allowed = await isCompanyIpAllowedByPolicy(req.companyId, ip, 'punch_allowed');
  if (!allowed) {
    return res.status(403).json({
      message: 'Punch-in is only allowed from office-approved network.',
      ip,
    });
  }
  return next();
};

// Use punch_allowed policy to limit certain employee actions to office networks.
export const enforceOfficePunchIpForEmployee = async (req, res, next) => {
  if (req.user?.role !== 'employee') {
    return next();
  }
  return enforcePunchIp(req, res, next);
};
