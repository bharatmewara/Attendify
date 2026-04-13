import { query } from '../db.js';
import { getClientIp } from '../utils/network.js';

export const isCompanyIpAllowedByPolicy = async (companyId, ip, policyField) => {
  try {
    // Always allow loopback (server-side / local dev only)
    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return true;
    }

    // If no active policies configured for this company, allow everyone
    const policiesExist = await query(
      `SELECT COUNT(*) as count FROM network_policies WHERE company_id = $1 AND is_active = TRUE AND ${policyField} = TRUE`,
      [companyId]
    );

    if (parseInt(policiesExist.rows[0].count, 10) === 0) {
      return true;
    }

    // Policies exist — only allow if IP matches one of them
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
    console.error('Network policy check error:', error.message, '| IP:', ip);
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
