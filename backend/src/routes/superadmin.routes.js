import express from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';

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

// Create company
router.post('/companies', authenticate, authorize('super_admin'), async (req, res) => {
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
    plan_id,
    payment_status,
    billing_cycle,
  } = req.body;

  if (!company_name || !email || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'Company name, contact email, admin email, and admin password are required' });
  }

  if (admin_password.length < 6) {
    return res.status(400).json({ message: 'Admin password must be at least 6 characters' });
  }

  if ((plan_id || billing_cycle || payment_status) && !plan_id) {
    return res.status(400).json({ message: 'A valid plan is required when subscription details are provided' });
  }

  if (plan_id && !['monthly', 'yearly'].includes(billing_cycle)) {
    return res.status(400).json({ message: 'Billing cycle must be monthly or yearly' });
  }

  if (plan_id && payment_status && !['paid', 'unpaid'].includes(payment_status)) {
    return res.status(400).json({ message: 'Payment status must be paid or unpaid' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const resolvedCompanyCode = company_code?.trim()
      ? slugifyCompanyCode(company_code.trim())
      : await generateUniqueCompanyCode(client, company_name);

    if (!resolvedCompanyCode) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Unable to generate a valid company code from the company name' });
    }

    const existingCompany = await client.query(
      'SELECT id FROM companies WHERE company_code = $1 LIMIT 1',
      [resolvedCompanyCode]
    );
    if (existingCompany.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Company code already exists' });
    }

    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [admin_email]
    );
    if (existingAdmin.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Company admin email already exists' });
    }

    let selectedPlan = null;
    if (plan_id) {
      const planResult = await client.query(
        'SELECT id, price_monthly, price_yearly FROM subscription_plans WHERE id = $1',
        [plan_id]
      );
      if (planResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected plan does not exist' });
      }
      selectedPlan = planResult.rows[0];
    }

    const companySubscriptionStatus = plan_id && payment_status === 'paid' ? 'active' : 'trial';
    const companyResult = await client.query(
      `INSERT INTO companies (
        company_name, company_code, email, phone, address, website, industry, subscription_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        company_name,
        resolvedCompanyCode,
        email,
        nullable(phone),
        nullable(address),
        nullable(website),
        nullable(industry),
        companySubscriptionStatus,
      ]
    );

    const company = companyResult.rows[0];
    const passwordHash = await bcrypt.hash(admin_password, 10);

    await client.query(
      `INSERT INTO users (company_id, email, password_hash, role, is_active, email_verified)
       VALUES ($1, $2, $3, 'company_admin', true, false)`,
      [company.id, admin_email, passwordHash]
    );

    if (selectedPlan) {
      const amount = billing_cycle === 'yearly' ? selectedPlan.price_yearly : selectedPlan.price_monthly;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (billing_cycle === 'yearly' ? 12 : 1));

      await client.query(
        `INSERT INTO company_subscriptions (company_id, plan_id, billing_cycle, start_date, end_date, amount, status)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'active')`,
        [company.id, selectedPlan.id, billing_cycle, endDate, amount]
      );
    }

    await client.query('COMMIT');

    await logAudit({
      userId: req.user.id,
      action: 'CREATE_COMPANY',
      entityType: 'company',
      entityId: company.id,
      newValues: company,
      ipAddress: req.ip,
    });

    res.status(201).json(company);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

// Update company
router.put('/companies/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Build dynamic update query only for provided fields
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Only update fields that are explicitly provided
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && updates[key] !== null && key !== 'id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp
    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
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

// Reset company admin password
router.post('/companies/:id/reset-password', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  try {
    // Get company admin user
    const userResult = await query(
      'SELECT id FROM users WHERE company_id = $1 AND role = $2 LIMIT 1',
      [id, 'company_admin']
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Company admin not found' });
    }

    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(new_password, 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [password_hash, userResult.rows[0].id]
    );

    await logAudit({
      userId: req.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'user',
      entityId: userResult.rows[0].id,
      ipAddress: req.ip,
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subscription plans
router.get('/subscription-plans', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY price_monthly');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update subscription plan
router.put('/subscription-plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Handle each field
    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount}`);
      values.push(updates.name);
      paramCount++;
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramCount}`);
      values.push(updates.description);
      paramCount++;
    }
    if (updates.price_monthly !== undefined) {
      fields.push(`price_monthly = $${paramCount}`);
      values.push(updates.price_monthly);
      paramCount++;
    }
    if (updates.price_yearly !== undefined) {
      fields.push(`price_yearly = $${paramCount}`);
      values.push(updates.price_yearly);
      paramCount++;
    }
    if (updates.employee_limit !== undefined) {
      fields.push(`employee_limit = $${paramCount}`);
      values.push(updates.employee_limit);
      paramCount++;
    }
    if (updates.features !== undefined) {
      fields.push(`features = $${paramCount}`);
      values.push(JSON.stringify(updates.features));
      paramCount++;
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramCount}`);
      values.push(updates.is_active);
      paramCount++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get expiring subscriptions
router.get('/expiring-subscriptions', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT cs.*, c.company_name, c.email, sp.name as plan_name,
        DATE_PART('day', cs.end_date - CURRENT_DATE) as days_remaining
      FROM company_subscriptions cs
      JOIN companies c ON cs.company_id = c.id
      JOIN subscription_plans sp ON cs.plan_id = sp.id
      WHERE cs.status = 'active' 
        AND cs.end_date <= CURRENT_DATE + INTERVAL '30 days'
        AND cs.end_date >= CURRENT_DATE
      ORDER BY cs.end_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending payments
router.get('/pending-payments', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT sp.*, c.company_name, c.email, cs.billing_cycle,
        DATE_PART('day', sp.due_date - CURRENT_DATE) as days_overdue
      FROM subscription_payments sp
      JOIN companies c ON sp.company_id = c.id
      JOIN company_subscriptions cs ON sp.subscription_id = cs.id
      WHERE sp.status = 'pending'
        AND sp.due_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY sp.due_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send notification to company
router.post('/notifications', authenticate, authorize('super_admin'), async (req, res) => {
  const { company_id, title, message, type, priority } = req.body;

  try {
    const result = await query(
      `INSERT INTO notifications (company_id, title, message, type, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, title, message, type || 'info', priority || 'normal', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all notifications
router.get('/notifications', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT n.*, c.company_name, u.full_name as created_by_name
      FROM notifications n
      LEFT JOIN companies c ON n.company_id = c.id
      LEFT JOIN users u ON n.created_by = u.id
      ORDER BY n.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create subscription plan
router.post('/subscription-plans', authenticate, authorize('super_admin'), async (req, res) => {
  const { name, description, price_monthly, price_yearly, employee_limit, features } = req.body;

  try {
    const result = await query(
      `INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, employee_limit, features)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, price_monthly, price_yearly, employee_limit, JSON.stringify(features)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete subscription plan
router.delete('/subscription-plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const usageResult = await query(
      'SELECT COUNT(*)::int AS usage_count FROM company_subscriptions WHERE plan_id = $1',
      [id]
    );

    if (usageResult.rows[0]?.usage_count > 0) {
      return res.status(400).json({ message: 'This plan is assigned to one or more companies and cannot be deleted' });
    }

    const deleteResult = await query(
      'DELETE FROM subscription_plans WHERE id = $1 RETURNING id',
      [id]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get platform analytics
router.get('/analytics', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM companies WHERE is_active = true) as active_companies,
        (SELECT COUNT(*) FROM companies) as total_companies,
        (SELECT COUNT(*) FROM employees) as total_employees,
        (SELECT COUNT(*) FROM users WHERE last_login_at > NOW() - INTERVAL '30 days') as active_users,
        (SELECT COALESCE(SUM(amount), 0) FROM subscription_payments WHERE status = 'completed' AND payment_date > NOW() - INTERVAL '30 days') as monthly_revenue
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get payment history
router.get('/payments', authenticate, authorize('super_admin'), async (req, res) => {
  try {
    const result = await query(`
      SELECT sp.*, c.company_name, cs.billing_cycle
      FROM subscription_payments sp
      JOIN companies c ON sp.company_id = c.id
      JOIN company_subscriptions cs ON sp.subscription_id = cs.id
      ORDER BY sp.payment_date DESC
      LIMIT 100
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
