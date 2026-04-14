import express from 'express';
import { authenticate, authorize, tenantIsolation } from '../middleware/auth.middleware.js';
import { query } from '../db.js';

const router = express.Router();

router.use(authenticate, authorize('company_admin', 'super_admin'));

router.get('/', tenantIsolation, async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) {
    return res.status(400).json({ message: 'company_id is required' });
  }
  try {
    const result = await query(
      `SELECT id, label, network_cidr::text, employee_login_allowed, punch_allowed, is_active, created_at
       FROM network_policies
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [companyId],
    );
    return res.json({ policies: result.rows });
  } catch (error) {
    console.error('network GET error:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

router.post('/', tenantIsolation, async (req, res) => {
  const { label, networkCidr, employeeLoginAllowed, punchAllowed, isActive } = req.body;
  const companyId = req.companyId;
  if (!label || !networkCidr) {
    return res.status(400).json({ message: 'label and networkCidr are required' });
  }
  if (!companyId) {
    return res.status(400).json({ message: 'company_id is required' });
  }
  try {
    // Use PostgreSQL to normalize the CIDR (masks host bits automatically)
    const normalized = await query(`SELECT network($1::inet)::text AS cidr`, [networkCidr]);
    const cidr = normalized.rows[0].cidr;

    const created = await query(
      `INSERT INTO network_policies
        (company_id, label, network_cidr, employee_login_allowed, punch_allowed, is_active, created_by)
       VALUES ($1, $2, $3::cidr, $4, $5, $6, $7)
       RETURNING id, label, network_cidr::text, employee_login_allowed, punch_allowed, is_active, created_at`,
      [
        companyId,
        label,
        cidr,
        Boolean(employeeLoginAllowed),
        Boolean(punchAllowed),
        isActive !== false,
        req.user.id,
      ],
    );
    return res.status(201).json({ policy: created.rows[0] });
  } catch (error) {
    console.error('network POST error:', error.message);
    if (error.message.includes('invalid') || error.message.includes('cidr') || error.message.includes('inet')) {
      return res.status(400).json({ message: `Invalid IP/CIDR: "${networkCidr}". Use format like 192.168.1.0/24 or 192.168.1.5/32` });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', tenantIsolation, async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  try {
    const current = await query(
      'SELECT * FROM network_policies WHERE id = $1 AND company_id = $2 LIMIT 1',
      [id, companyId],
    );
    const existing = current.rows[0];
    if (!existing) {
      return res.status(404).json({ message: 'Policy not found' });
    }

    let cidr = existing.network_cidr;
    if (req.body.networkCidr) {
      // Normalize the CIDR
      const normalized = await query(`SELECT network($1::inet)::text AS cidr`, [req.body.networkCidr]);
      cidr = normalized.rows[0].cidr;
    }

    const next = {
      label: req.body.label ?? existing.label,
      network_cidr: cidr,
      employee_login_allowed: req.body.employeeLoginAllowed ?? existing.employee_login_allowed,
      punch_allowed: req.body.punchAllowed ?? existing.punch_allowed,
      is_active: req.body.isActive ?? existing.is_active,
    };

    const updated = await query(
      `UPDATE network_policies
       SET label = $1, network_cidr = $2::cidr, employee_login_allowed = $3,
           punch_allowed = $4, is_active = $5
       WHERE id = $6
       RETURNING id, label, network_cidr::text, employee_login_allowed, punch_allowed, is_active, created_at`,
      [next.label, next.network_cidr, next.employee_login_allowed, next.punch_allowed, next.is_active, id],
    );
    return res.json({ policy: updated.rows[0] });
  } catch (error) {
    console.error('network PATCH error:', error.message);
    if (error.message.includes('invalid') || error.message.includes('cidr') || error.message.includes('inet')) {
      return res.status(400).json({ message: `Invalid IP/CIDR format. Use format like 192.168.1.0/24 or 192.168.1.5/32` });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', tenantIsolation, async (req, res) => {
  const companyId = req.companyId;
  try {
    const deleted = await query(
      'DELETE FROM network_policies WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, companyId],
    );
    if (!deleted.rows[0]) {
      return res.status(404).json({ message: 'Policy not found' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('network DELETE error:', error.message);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
