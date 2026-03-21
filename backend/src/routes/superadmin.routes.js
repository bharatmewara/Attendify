import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { uploadCompany } from '../middleware/uploads.js';
import { logAudit } from '../utils/audit.js';
import { config } from '../config.js';

const router = express.Router();

const nullable = (value) => (value === '' || value === undefined ? null : value);
const slugifyCompanyCode = (value) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

const generateUniqueCompanyCode = async (client, companyName) => {
  const baseCode = slugifyCompanyCode(companyName) || 'COMPANY';
  let candidateCode = baseCode;
  let suffix = 1;

  while (true) {
    const existingCompany = await client.query(
      'SELECT id FROM companies WHERE company_code = $1 LIMIT 1',
      [candidateCode]
    );

    if (existingCompany.rows.length === 0) {
      return candidateCode;
    }

    suffix += 1;
    candidateCode = `${baseCode.slice(0, Math.max(1, 24 - String(suffix).length - 1))}_${suffix}`;
  }
};

router.get('/companies', authenticate, authorize('super_admin'), async (_req, res) => {
  try {
    const result = await query(`
      SELECT c.*,
        COUNT(DISTINCT e.id) as employee_count,
        cs.id as subscription_id,
        cs.status as subscription_status,
        cs.start_date,
        cs.end_date,
        cs.billing_cycle,
        cs.amount as subscription_amount,
        sp.id as plan_id,
        sp.name as plan_name,
        sp.features as plan_features
      FROM companies c
      LEFT JOIN employees e ON c.id = e.company_id
      LEFT JOIN LATERAL (
        SELECT * FROM company_subscriptions
        WHERE company_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) cs ON true
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      GROUP BY c.id, cs.id, cs.status, cs.start_date, cs.end_date, cs.billing_cycle, cs.amount, sp.id, sp.name, sp.features
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/companies', authenticate, authorize('super_admin'), uploadCompany.single('logo'), async (req, res) => {
  const {
    company_name,
    company_code,
    email,
    phone,
    address,
    website,
    industry,
    admin_email,
    admin_password,
  } = req.body || {};

  if (!company_name || !email || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'company_name, email, admin_email and admin_password are required' });
  }

  if (String(admin_password).length < 6) {
    return res.status(400).json({ message: 'Admin password must be at least 6 characters' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const normalizedCompanyCode = company_code ? slugifyCompanyCode(company_code) : await generateUniqueCompanyCode(client, company_name);

    const existingCode = await client.query('SELECT id FROM companies WHERE company_code = $1 LIMIT 1', [normalizedCompanyCode]);
    if (existingCode.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Company code already exists' });
    }

    const existingAdminEmail = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [admin_email]);
    if (existingAdminEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Admin email already exists' });
    }

    const companyResult = await client.query(
      `INSERT INTO companies (company_name, company_code, email, phone, address, website, industry, is_active, subscription_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'trial')
       RETURNING *`,
      [
        company_name,
        normalizedCompanyCode,
        email,
        nullable(phone),
        nullable(address),
        nullable(website),
        nullable(industry),
      ]
    );

    const company = companyResult.rows[0];
    const passwordHash = await bcrypt.hash(String(admin_password), 10);

    await client.query(
      `INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified)
       VALUES ($1, $2, $3, 'company_admin', true, false)`,
      [company.id, admin_email, passwordHash]
    );

    await client.query('COMMIT');

    await logAudit({
      companyId: company.id,
      userId: req.user.id,
      action: 'create',
      entityType: 'company',
      entityId: company.id,
      newValues: { company_name, company_code: normalizedCompanyCode, email, admin_email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(company);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.put('/companies/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const companyId = Number(req.params.id);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(400).json({ message: 'Invalid company id' });
  }

  const allowedFields = [
    'company_name',
    'email',
    'phone',
    'address',
    'website',
    'industry',
    'is_active',
    'subscription_status',
  ];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      const nextValue = ['phone', 'address', 'website', 'industry'].includes(field)
        ? nullable(req.body[field])
        : req.body[field];
      values.push(nextValue);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  values.push(companyId);

  try {
    const result = await query(
      `UPDATE companies
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.delete('/companies/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const companyId = Number(req.params.id);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(400).json({ message: 'Invalid company id' });
  }

  try {
    const companyResult = await query('SELECT id, company_name FROM companies WHERE id = $1', [companyId]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    await query('DELETE FROM companies WHERE id = $1', [companyId]);

    await logAudit({
      companyId,
      userId: req.user.id,
      action: 'delete',
      entityType: 'company',
      entityId: companyId,
      oldValues: companyResult.rows[0],
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});
router.post('/companies/:id/assign-subscription', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { plan_id, billing_cycle, payment_status = 'paid' } = req.body;

  try {
    if (!plan_id || !billing_cycle || !['monthly', 'yearly'].includes(billing_cycle)) {
      return res.status(400).json({ message: 'plan_id and billing_cycle (monthly/yearly) required' });
    }

    const companyResult = await query('SELECT id, company_name FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const planResult = await query(
      'SELECT id, name, price_monthly, price_yearly FROM subscription_plans WHERE id = $1 AND is_active = true',
      [plan_id]
    );
    if (planResult.rows.length === 0) {
      return res.status(404).json({ message: 'Active plan not found' });
    }
    const plan = planResult.rows[0];

    const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
    const status = payment_status === 'paid' ? 'active' : 'pending_payment';
    const start_date = new Date().toISOString().split('T')[0];
    let end_date = new Date();
    end_date.setMonth(end_date.getMonth() + (billing_cycle === 'yearly' ? 12 : 1));
    end_date = end_date.toISOString().split('T')[0];

    await query("UPDATE company_subscriptions SET status = 'expired' WHERE company_id = $1 AND status = 'active'", [id]);

    await query(
      `INSERT INTO company_subscriptions (company_id, plan_id, status, billing_cycle, amount, start_date, end_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (company_id) DO UPDATE SET plan_id = $2, status = $3, billing_cycle = $4, amount = $5, start_date = $6, end_date = $7`,
      [id, plan_id, status, billing_cycle, amount, start_date, end_date]
    );

    const updated = await query(`
      SELECT c.*, COUNT(DISTINCT e.id)::int as employee_count, cs.*,
             sp.name as plan_name, sp.features as plan_features
      FROM companies c
      LEFT JOIN employees e ON c.id = e.company_id
      LEFT JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.status='active'
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE c.id = $1
      GROUP BY c.id, cs.id, sp.id, sp.name, sp.features
    `, [id]);

    res.json({
      success: true,
      message: `Assigned ${plan.name} (${billing_cycle.toUpperCase()}, amount ${amount})`,
      company: updated.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/companies/:id/reset-password', authenticate, authorize('super_admin'), async (req, res) => {
  const companyId = Number(req.params.id);
  const { new_password } = req.body || {};

  if (!Number.isInteger(companyId) || companyId <= 0) {
    return res.status(400).json({ message: 'Invalid company id' });
  }

  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ message: 'new_password must be at least 6 characters' });
  }

  try {
    const adminResult = await query(
      `SELECT id, company_id, email
       FROM users
       WHERE company_id = $1 AND role = 'company_admin'
       ORDER BY created_at ASC
       LIMIT 1`,
      [companyId]
    );

    if (adminResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company admin not found' });
    }

    const admin = adminResult.rows[0];
    const passwordHash = await bcrypt.hash(String(new_password), 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, admin.id]
    );

    await logAudit({
      companyId,
      userId: req.user.id,
      action: 'reset_password',
      entityType: 'user',
      entityId: admin.id,
      newValues: { email: admin.email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/notifications', authenticate, authorize('super_admin'), async (_req, res) => {
  try {
    const result = await query(
      `SELECT n.*, c.company_name, u.email as created_by_email
       FROM notifications n
       LEFT JOIN companies c ON c.id = n.company_id
       LEFT JOIN users u ON u.id = n.created_by
       ORDER BY n.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/notifications', authenticate, authorize('super_admin'), async (req, res) => {
  const { company_id, title, message, type = 'info', priority = 'normal' } = req.body || {};

  if (!company_id || !title || !message) {
    return res.status(400).json({ message: 'company_id, title and message are required' });
  }

  try {
    const result = await query(
      `INSERT INTO notifications (company_id, title, message, type, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, title, message, type, priority, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/subscription-plans', authenticate, authorize('super_admin'), async (req, res) => {
  const {
    name,
    description,
    price_monthly,
    price_yearly,
    employee_limit,
    features = {},
    is_active = true,
  } = req.body || {};

  if (!name || price_monthly === undefined || price_yearly === undefined || employee_limit === undefined) {
    return res.status(400).json({ message: 'name, price_monthly, price_yearly, employee_limit are required' });
  }

  try {
    const result = await query(
      `INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, employee_limit, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        nullable(description),
        Number(price_monthly),
        Number(price_yearly),
        Number(employee_limit),
        JSON.stringify(features || {}),
        Boolean(is_active),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.put('/subscription-plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ message: 'Invalid plan id' });
  }

  const updatable = ['name', 'description', 'price_monthly', 'price_yearly', 'employee_limit', 'features', 'is_active'];
  const updates = [];
  const values = [];

  for (const field of updatable) {
    if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
      let value = req.body[field];
      if (field === 'description') value = nullable(value);
      if (field === 'features') value = JSON.stringify(value || {});
      if (['price_monthly', 'price_yearly', 'employee_limit'].includes(field)) value = Number(value);
      if (field === 'is_active') value = Boolean(value);

      values.push(value);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  values.push(planId);

  try {
    const result = await query(
      `UPDATE subscription_plans
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Plan update error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/companies/:id/impersonate', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const companyResult = await query('SELECT * FROM companies WHERE id = $1', [id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let admin = await query(
      `SELECT u.id, u.email, u.role, u.company_id, c.company_name
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.company_id = $1 AND u.role = 'company_admin'
       ORDER BY u.created_at ASC
       LIMIT 1`,
      [id]
    );

    if (admin.rows.length === 0) {
      const password = 'TempPass123!';
      const passwordHash = await bcrypt.hash(password, 10);
      const companyCodeResult = await query('SELECT company_code FROM companies WHERE id = $1', [id]);
      const companyCode = companyCodeResult.rows[0].company_code;
      const adminEmail = `admin@${companyCode.toLowerCase().replace(/_/g, '')}.company`;

      const adminResult = await query(
        `INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified)
         VALUES ($1, $2, $3, 'company_admin', true, false)
         RETURNING id, email, role, company_id`,
        [id, adminEmail, passwordHash]
      );
      admin = adminResult;
    }

    const adminUser = admin.rows[0];

    const impersonateToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.company_id,
        impersonateBy: req.user.id,
        impersonateUntil: Date.now() + 24 * 60 * 60 * 1000,
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Impersonation token generated',
      token: impersonateToken,
      company: { id, company_name: companyResult.rows[0].company_name },
      admin: adminUser,
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/impersonate-exit', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const token = jwt.sign(
      {
        userId: req.user.originalSuperAdminId || req.user.id,
        email: req.user.email,
        role: 'super_admin',
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.get('/subscription-plans', authenticate, authorize('super_admin'), async (_req, res) => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price_monthly');
    res.json(result.rows);
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

router.delete('/subscription-plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const planId = Number(req.params.id);
  if (!Number.isInteger(planId) || planId <= 0) {
    return res.status(400).json({ message: 'Invalid plan id' });
  }

  try {
    const usageResult = await query('SELECT COUNT(*) as count FROM company_subscriptions WHERE plan_id = $1', [planId]);
    if (parseInt(usageResult.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Cannot delete plan assigned to companies' });
    }

    const result = await query('DELETE FROM subscription_plans WHERE id = $1 RETURNING id', [planId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    // FK violations are expected when a company still has dependent data.
    if (error?.code === '23503') {
      return res.status(409).json({
        message: 'Cannot delete company because related records exist. Deactivate it instead or remove dependent data first.',
      });
    }
    res.status(500).json({ message: error.message });
  }
});

export default router;










