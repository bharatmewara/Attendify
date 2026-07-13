import { query } from '../db.js';
import { getClientIp } from '../utils/network.js';

/**
 * Check if a given IP is allowed under an active company network policy.
 *
 * Behaviour:
 *  - Loopback (127.0.0.1 / ::1) → always allowed (server-internal calls)
 *  - If the company has NO active policies for `policyField` → everyone allowed (open mode)
 *  - If policies exist → IP must match at least one CIDR range in those policies
 */
export const isCompanyIpAllowedByPolicy = async (companyId, ip, policyField) => {
  try {
    if (!companyId) return true;

    // Normalize the IP
    const normalizedIp = ip ? ip.replace(/^::ffff:/, '') : '';

    // Only allow loopback in non-production environments (prevents bypass on VPS behind proxy)
    if (process.env.NODE_ENV !== 'production' && (normalizedIp === '127.0.0.1' || normalizedIp === '::1' || normalizedIp === 'localhost')) {
      return true;
    }

    if (!normalizedIp) {
      console.warn('[NetworkPolicy] Could not determine client IP — allowing by default');
      return true;
    }

    // Allowed field names (whitelist to prevent SQL injection)
    const ALLOWED_FIELDS = ['punch_allowed', 'employee_login_allowed'];
    if (!ALLOWED_FIELDS.includes(policyField)) {
      console.error('[NetworkPolicy] Invalid policyField:', policyField);
      return true;
    }

    // Check if any active policies exist for this field
    const policiesExist = await query(
      `SELECT COUNT(*) as count FROM network_policies WHERE company_id = $1 AND is_active = TRUE AND ${policyField} = TRUE`,
      [companyId],
    );

    if (parseInt(policiesExist.rows[0].count, 10) === 0) {
      // No policies configured → open access
      return true;
    }

    console.log(`[NetworkPolicy] Checking IP: ${normalizedIp} | company: ${companyId} | field: ${policyField}`);

    // Use PostgreSQL's inet CIDR matching for accurate subnet check
    const result = await query(
      `SELECT id, label, network_cidr::text
       FROM network_policies
       WHERE is_active = TRUE
         AND company_id = $2
         AND ${policyField} = TRUE
         AND $1::inet <<= network_cidr
       LIMIT 1`,
      [normalizedIp, companyId],
    );

    if (result.rows[0]) {
      console.log(`[NetworkPolicy] ALLOWED — matched: ${result.rows[0].label} (${result.rows[0].network_cidr})`);
      return true;
    }

    console.log(`[NetworkPolicy] BLOCKED — no policy matched IP: ${normalizedIp}`);
    return false;
  } catch (error) {
    // If the IP isn't valid inet format (e.g. IPv6 scoped), fail open to avoid locking out users
    console.error('[NetworkPolicy] Error during IP check:', error.message, '| IP:', ip);
    return true;
  }
};

/**
 * Middleware: Block employee login if company has login IP restrictions
 * and the current IP is not whitelisted.
 */
export const enforceEmployeeLoginIp = async (req, res, next) => {
  // Only applies to employees, and only if company context is known
  if (!req.user?.company_id || req.user?.role !== 'employee') {
    return next();
  }
  const ip = getClientIp(req);
  const allowed = await isCompanyIpAllowedByPolicy(req.user.company_id, ip, 'employee_login_allowed');
  if (!allowed) {
    return res.status(403).json({
      error: 'NETWORK_BLOCKED',
      message: 'Login from this network is not permitted. Please connect to the office Wi-Fi and try again.',
      ip,
    });
  }
  return next();
};

/**
 * Middleware: Block punch-in/out if company has punch IP restrictions
 * and the current IP is not whitelisted.
 *
 * Reads companyId from req.companyId (set by tenantIsolation) OR req.user.company_id.
 */
export const enforcePunchIp = async (req, res, next) => {
  // Resolve company ID from either source
  const companyId = req.companyId || req.user?.company_id;
  if (!companyId) {
    return next(); // No company context — allow
  }

  const ip = getClientIp(req);
  const allowed = await isCompanyIpAllowedByPolicy(companyId, ip, 'punch_allowed');
  if (!allowed) {
    return res.status(403).json({
      error: 'PUNCH_BLOCKED',
      message: 'Punch-in is only allowed from the office Wi-Fi network. Please connect to the approved network and try again.',
      ip,
    });
  }
  return next();
};

/**
 * Middleware: Apply punch IP restriction only for employees (not admins).
 * Used on endpoints that employees and admins both access.
 */
export const enforceOfficePunchIpForEmployee = async (req, res, next) => {
  if (req.user?.role !== 'employee') {
    return next(); // Admins bypass IP check
  }
  return enforcePunchIp(req, res, next);
};
