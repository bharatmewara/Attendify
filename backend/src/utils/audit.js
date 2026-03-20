import { query } from '../db.js';

export const logAudit = async ({
  companyId,
  userId,
  action,
  entityType,
  entityId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1::int, $2::int, $3::text, $4::text, $5::int, $6::jsonb, $7::jsonb, $8::text, $9::text)`,
      [
        companyId,
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
};
