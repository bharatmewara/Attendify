/**
 * Payroll Audit Logger — Attendify Enterprise HRMS
 *
 * Every payroll mutation writes an immutable audit trail to payroll_audit_logs.
 */

import { query } from '../db.js';

/**
 * Write a payroll audit log entry.
 *
 * @param {Object} params
 * @param {number}  params.companyId
 * @param {number}  params.userId
 * @param {string}  params.action      - e.g. 'cycle_created', 'payroll_run', 'payroll_approved'
 * @param {string}  params.entityType  - e.g. 'payroll_cycle', 'payroll_run_item'
 * @param {number}  [params.entityId]
 * @param {Object}  [params.oldValues]
 * @param {Object}  [params.newValues]
 * @param {string}  [params.ipAddress]
 * @param {string}  [params.userAgent]
 */
export async function writePayrollAudit({
  companyId,
  userId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
}) {
  try {
    await query(
      `INSERT INTO payroll_audit_logs
         (company_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        companyId,
        userId ?? null,
        action,
        entityType ?? null,
        entityId ?? null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );
  } catch (err) {
    // Audit failure should never crash the main request
    console.error('[payrollAudit] Failed to write audit log:', err.message);
  }
}

/**
 * Helper: extract IP and user agent from Express request.
 */
export function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}
