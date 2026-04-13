import { query } from '../db.js';
import { getClientIp } from '../utils/network.js';

export const isCompanyIpAllowedByPolicy = async (companyId, ip, policyField) => {
  try {
    // If no active policies configured for this field, allow everyone
    const policiesExist = await query(
      `SELECT COUNT(*) as count FROM network_policies WHERE company_id = $1 AND is_active = TRUE AND ${policyField} = TRUE`,
      [companyId]
    );

    if (parseInt(policiesExist.rows[0].count, 10) === 0) {
      return true;
    }

    // Policies exist — check if IP matches
    console.log(`[NetworkPolicy] Checking IP: ${ip} for company: ${companyId} field: ${policyField}`);

    const result = await query(
      `SELECT id, label, network_cidr::text
       FROM network_policies
       WHERE is_active = TRUE
         AND company_id = $2
         AND ${policyField} = TRUE
         AND $1::inet <<= network_cidr
       LIMIT 1`,
      [ip, companyId],
    );

    if (result.rows[0]) {
      console.log(`[NetworkPolicy] ALLOWED — matched policy: ${result.rows[0].label} (${result.rows[0].network_cidr})`);
    } else {
      console.log(`[NetworkPolicy] BLOCKED — no matching policy for IP: ${ip}`);
    }

    return Boolean(result.rows[0]);
  } catch (error) {
    console.error('[NetworkPolicy] Check error:', error.message, '| IP:', ip);
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
