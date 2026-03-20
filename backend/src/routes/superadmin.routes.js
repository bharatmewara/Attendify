import express from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { sendEmail } from '../utils/email.js';
import { uploadCompany } from '../middleware/uploads.js';
import jwt from 'jsonwebtoken';
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

// Get all companies
router.get('/companies', authenticate, authorize('super_admin'), async (req, res) => {
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
      LEFT JOIN company_subscriptions cs ON c.id = cs.company_id AND cs.status = 'active'
      LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
      GROUP BY c.id, cs.id, cs.status, cs.start_date, cs.end_date, cs.billing_cycle, cs.amount, sp.id, sp.name, sp.features
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Assign subscription to company - Step 2 of TODO.md
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

    // Deactivate existing
    await query("UPDATE company_subscriptions SET status = 'expired' WHERE company_id = $1 AND status = 'active'", [id]);

    // Insert new subscription
    await query(
      `INSERT INTO company_subscriptions (company_id, plan_id, status, billing_cycle, amount, start_date, end_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
       ON CONFLICT (company_id) DO UPDATE SET plan_id = $2, billing_cycle = $4, amount = $5, start_date = $6, end_date = $7`,
      [id, plan_id, status, billing_cycle, amount, start_date, end_date]
    );

    // Refresh company data
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
      message: "Assigned " + plan.name + " (" + billing_cycle.toUpperCase() + ", ₹" + amount + ")",
      company: updated.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ... [rest of routes unchanged until impersonate]

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
      // Auto-create company admin if none exists
      const password = 'TempPass123!';
      const passwordHash = await bcrypt.hash(password, 10);
      const companyCodeResult = await query('SELECT company_code FROM companies WHERE id = $1', [id]);
      const companyCode = companyCodeResult.rows[0].company_code;
      const adminEmail = `admin@` + companyCode.toLowerCase().replace(/_/g, '') + `.company`;

      const adminResult = await query(
        `INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified)
         VALUES ($1, $2, $3, 'company_admin', true, false)
         RETURNING id, email, role, company_id`,
        [id, adminEmail, passwordHash]
      );
      admin = adminResult;
      console.log(`Auto-created company admin for company ${id}: ${admin.rows[0].email}, password: ${password}`);
    }

    const adminUser = admin.rows[0];

    // Generate temporary token for impersonation
    const impersonateToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        companyId: adminUser.company_id,
        impersonateBy: req.user.id,
        impersonateUntil: Date.now() + 24 * 60 * 60 * 1000 // 24h
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Impersonation token generated',
      token: impersonateToken,
      company: { id: id, company_name: companyResult.rows[0].company_name },
      admin: adminUser
    });
  } catch (error) {
    console.error('Impersonation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Super admin impersonate exit - return super admin token
router.get('/impersonate-exit/:superAdminId', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const result = await query('SELECT id, email, role FROM users WHERE id = $1 AND role = \'super_admin\'', [superAdminId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Super admin not found' });
    }

    const superAdmin = result.rows[0];
    const token = jwt.sign({
      userId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role
    }, config.jwtSecret, { expiresIn: '24h' });

    res.json({ token, user: superAdmin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
