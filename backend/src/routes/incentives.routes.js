import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';

const router = express.Router();
let schemaReady = false;

const ensureSchema = async () => {
  if (schemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS incentive_configs (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      incentive_type VARCHAR(100) NOT NULL,
      package_volume INTEGER NOT NULL,
      unit_price NUMERIC(10,4) NOT NULL,
      incentive_amount NUMERIC(10,2) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS incentive_requests (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      incentive_config_id INTEGER NOT NULL REFERENCES incentive_configs(id),
      payment_type VARCHAR(30) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      screenshot_url TEXT,
      note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_by INTEGER,
      approved_at TIMESTAMPTZ,
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Backward-compatible schema upgrades for older deployments.
  await query(`ALTER TABLE incentive_configs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`)
  await query(`ALTER TABLE incentive_configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  await query(`ALTER TABLE incentive_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  await query(`UPDATE incentive_configs SET is_active = true WHERE is_active IS NULL`)

  schemaReady = true;
};

const resolveEmployeeIdForUser = async (userId) => {
  const result = await query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0]?.id || null;
};

router.get('/config', authenticate, tenantIsolation, async (req, res) => {
  try {
    await ensureSchema();
    const result = await query(
      `SELECT *
       FROM incentive_configs
       WHERE ($1::int IS NULL OR company_id = $1)
         AND is_active = true
       ORDER BY incentive_type, package_volume`,
      [req.companyId],
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/config', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { incentive_type, package_volume, unit_price, incentive_amount } = req.body || {};

  if (!incentive_type || !package_volume || !unit_price || incentive_amount === undefined) {
    return res.status(400).json({ message: 'incentive_type, package_volume, unit_price and incentive_amount are required' });
  }

  try {
    await ensureSchema();
    const result = await query(
      `INSERT INTO incentive_configs (company_id, incentive_type, package_volume, unit_price, incentive_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.companyId, incentive_type, Number(package_volume), Number(unit_price), Number(incentive_amount), req.user.id],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/config/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { incentive_type, package_volume, unit_price, incentive_amount, is_active } = req.body || {};

  try {
    await ensureSchema();
    const result = await query(
      `UPDATE incentive_configs
       SET incentive_type = COALESCE($1, incentive_type),
           package_volume = COALESCE($2, package_volume),
           unit_price = COALESCE($3, unit_price),
           incentive_amount = COALESCE($4, incentive_amount),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
         AND company_id = $7
       RETURNING *`,
      [
        incentive_type ?? null,
        package_volume !== undefined ? Number(package_volume) : null,
        unit_price !== undefined ? Number(unit_price) : null,
        incentive_amount !== undefined ? Number(incentive_amount) : null,
        is_active ?? null,
        Number(req.params.id),
        req.companyId,
      ],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Incentive config not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/config/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    await ensureSchema();
    const result = await query(
      `UPDATE incentive_configs
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
         AND company_id = $2
       RETURNING id`,
      [Number(req.params.id), req.companyId],
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Incentive config not found' });
    }

    return res.json({ message: 'Incentive config deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/requests', authenticate, tenantIsolation, async (req, res) => {
  try {
    await ensureSchema();

    let employeeId = null;
    if (req.user.role === 'employee') {
      employeeId = await resolveEmployeeIdForUser(req.user.id);
      if (!employeeId) return res.json([]);
    }

    const params = [req.companyId];
    let queryText = `
      SELECT ir.*, ic.incentive_type, ic.package_volume, ic.unit_price, ic.incentive_amount,
             e.first_name, e.last_name, e.employee_code
      FROM incentive_requests ir
      JOIN incentive_configs ic ON ic.id = ir.incentive_config_id
      JOIN employees e ON e.id = ir.employee_id
      WHERE ($1::int IS NULL OR ir.company_id = $1)
    `;

    if (employeeId) {
      queryText += ` AND ir.employee_id = $2`;
      params.push(employeeId);
    }

    queryText += ' ORDER BY ir.requested_at DESC';

    const result = await query(queryText, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/requests', authenticate, authorize('employee'), tenantIsolation, async (req, res) => {
  const { incentive_config_id, payment_type = 'new', quantity = 1, screenshot_url, note } = req.body || {};

  if (!incentive_config_id) {
    return res.status(400).json({ message: 'incentive_config_id is required' });
  }

  try {
    await ensureSchema();
    const employeeId = await resolveEmployeeIdForUser(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const configResult = await query(
      `SELECT *
       FROM incentive_configs
       WHERE id = $1
         AND ($2::int IS NULL OR company_id = $2)
         AND is_active = true`,
      [Number(incentive_config_id), req.companyId],
    );
    if (!configResult.rows.length) {
      return res.status(404).json({ message: 'Incentive configuration not found' });
    }

    const cfg = configResult.rows[0];

    const result = await query(
      `INSERT INTO incentive_requests (company_id, employee_id, incentive_config_id, payment_type, quantity, screenshot_url, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.companyId, employeeId, Number(incentive_config_id), String(payment_type), Number(quantity || 1), screenshot_url || null, note || null],
    );

    return res.status(201).json({
      ...result.rows[0],
      calculated_incentive: Number(cfg.incentive_amount) * Number(quantity || 1),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/requests/:id/status', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(String(status))) {
    return res.status(400).json({ message: 'status must be pending, approved, or rejected' });
  }

  try {
    await ensureSchema();
    const result = await query(
      `UPDATE incentive_requests
       SET status = $1,
           approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE NULL END,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3
         AND company_id = $4
       RETURNING *`,
      [String(status), req.user.id, Number(req.params.id), req.companyId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Incentive request not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
