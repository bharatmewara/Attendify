import express from 'express';
import path from 'path';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { enforceOfficePunchIpForEmployee } from '../middleware/networkPolicy.js';
import { uploadIncentiveScreenshot } from '../middleware/incentive_uploads.js';
import { sendEmail } from '../utils/email.js';

const router = express.Router();

const resolveEmployeeIdForUser = async (userId) => {
  const result = await query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0]?.id || null;
};

const toUploadsRelativePath = (file) => {
  if (!file) return null;
  // express serves `backend/uploads` at `/uploads`
  return path.posix.join('uploads', 'incentives', file.filename);
};

// Function to calculate incentive based on the provided logic
const calculateIncentive = (productName, smsQuantity, rate, price, packageType) => {
  let incentive = 0;

  if (productName === 'Bulk SMS') {
    if (rate >= 0.08 && rate <= 0.14) {
      if (smsQuantity >= 100000 && smsQuantity < 200000) incentive = 200;
      else if (smsQuantity >= 200000 && smsQuantity < 300000) incentive = 250;
      else if (smsQuantity >= 300000 && smsQuantity < 400000) incentive = 300;
      else if (smsQuantity >= 400000 && smsQuantity < 500000) incentive = 400;
      else if (smsQuantity >= 500000 && smsQuantity <= 900000) incentive = 500;
    }
    if (smsQuantity >= 1000000 && smsQuantity <= 1500000) {
      incentive += price * 0.02;
    }
  } else if (productName === 'WhatsApp SMS') {
    if (smsQuantity >= 50000 && smsQuantity < 100000 && rate >= 0.03 && rate <= 0.04) incentive = 100;
    else if (smsQuantity >= 100000 && smsQuantity < 200000) {
      if (rate >= 0.05 && rate <= 0.06) incentive = 200;
      else if (rate >= 0.06 && rate <= 0.12) incentive = 300;
    } else if (smsQuantity >= 200000 && smsQuantity < 300000) {
      if (rate >= 0.03 && rate <= 0.04) incentive = 200;
      else if (rate >= 0.05 && rate <= 0.06) incentive = 300;
      else if (rate >= 0.07 && rate <= 0.12) incentive = 400;
    } else if (smsQuantity >= 300000 && smsQuantity < 400000) {
      if (rate >= 0.03 && rate <= 0.04) incentive = 250;
      else if (rate >= 0.05 && rate <= 0.06) incentive = 350;
      else if (rate >= 0.07 && rate <= 0.12) incentive = 500;
    } else if (smsQuantity >= 400000 && smsQuantity < 500000) {
      if (rate >= 0.03 && rate <= 0.04) incentive = 300;
      else if (rate >= 0.05 && rate <= 0.06) incentive = 400;
      else if (rate >= 0.07 && rate <= 0.12) incentive = 600;
    } else if (smsQuantity >= 500000) {
      if (rate >= 0.03 && rate <= 0.06) incentive = 400;
      else if (rate >= 0.07 && rate <= 0.09) incentive = 900;
      else if (rate >= 0.1 && rate <= 0.12) incentive = 1200;
    }
  } else if (productName === 'WhatsApp Meta Setup') {
    incentive = 100;
  } else if (productName === 'WhatsApp Meta Recharge') {
    if (price <= 5000) incentive = 100;
  } else if (productName === 'WhatsApp Meta Subscription') {
    incentive = 200;
  } else if (productName === 'RCS Setup') {
    incentive = 100;
  } else if (productName === 'RCS Recharge') {
    if (price <= 15000) incentive = 100;
  }

  if (packageType === 'renew') {
    incentive /= 2;
  }

  return incentive;
};

router.get('/submissions', authenticate, tenantIsolation, enforceOfficePunchIpForEmployee, async (req, res) => {
  try {
    let employeeId = null;
    if (req.user.role === 'employee') {
      employeeId = await resolveEmployeeIdForUser(req.user.id);
      if (!employeeId) return res.json([]);
    }

    const params = [req.companyId];
    let queryText = `
      SELECT sub.*, e.first_name, e.last_name, e.employee_code
      FROM incentive_submissions sub
      JOIN employees e ON e.id = sub.employee_id
      WHERE ($1::int IS NULL OR sub.company_id = $1)
    `;

    if (employeeId) {
      queryText += ` AND sub.employee_id = $2`;
      params.push(employeeId);
    }

    queryText += ' ORDER BY sub.submitted_at DESC';

    const result = await query(queryText, params);
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/earnings', authenticate, tenantIsolation, enforceOfficePunchIpForEmployee, async (req, res) => {
  try {
    let employeeId = null;
    if (req.user.role === 'employee') {
      employeeId = await resolveEmployeeIdForUser(req.user.id);
      if (!employeeId) return res.json([]);
    }

    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    const employeeFilter = employeeId || (req.query.employee_id ? Number(req.query.employee_id) : null);

    const result = await query(
      `SELECT ie.*, e.first_name, e.last_name, e.employee_code
       FROM incentive_earnings ie
       JOIN employees e ON e.id = ie.employee_id
       WHERE ($1::int IS NULL OR ie.company_id = $1)
         AND ($2::int IS NULL OR ie.earned_month = $2)
         AND ($3::int IS NULL OR ie.earned_year = $3)
         AND ($4::int IS NULL OR ie.employee_id = $4)
       ORDER BY ie.earned_at DESC`,
      [req.companyId, month, year, employeeFilter],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Incentive earnings fetch failed', error);
    return res.status(500).json({ message: error.message });
  }
});
router.post(
  '/submissions',
  authenticate,
  authorize('employee'),
  tenantIsolation,
  enforceOfficePunchIpForEmployee,
  uploadIncentiveScreenshot.single('screenshot'),
  async (req, res) => {
    const {
      client_name,
      product_name,
      client_mobile_1,
      client_mobile_2,
      client_email,
      client_username,
      sms_quantity,
      rate,
      price,
      payment_mode,
      package_type,
      client_location,
    } = req.body;

    if (!client_name || !product_name || !package_type) {
      return res.status(400).json({ message: 'Client name, product name, and package type are required.' });
    }

    if (!client_mobile_1 || !client_email) {
      return res.status(400).json({ message: 'Client mobile number and email are required.' });
    }

    const rateValue = rate === undefined || rate === null || rate === '' ? null : Number(rate);
    if (rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0 || rateValue >= 1)) {
      return res.status(400).json({ message: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
    }

    try {
      const employeeId = await resolveEmployeeIdForUser(req.user.id);
      if (!employeeId) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }

      const incentive_amount = calculateIncentive(
        product_name,
        Number(sms_quantity),
        Number(rate),
        Number(price),
        package_type,
      );
      const screenshot_path = toUploadsRelativePath(req.file);

      const result = await query(
        `INSERT INTO incentive_submissions 
          (
            company_id,
            employee_id,
            client_name,
            product_name,
            client_mobile_1,
            client_mobile_2,
            client_email,
            client_username,
            sms_quantity,
            rate,
            price,
            payment_mode,
            package_type,
            client_location,
            incentive_amount,
            screenshot_path
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [
          req.companyId,
          employeeId,
          client_name,
          product_name,
          String(client_mobile_1),
          client_mobile_2 ? String(client_mobile_2) : null,
          String(client_email),
          client_username ? String(client_username) : null,
          sms_quantity ? Number(sms_quantity) : null,
          rate ? Number(rate) : null,
          price ? Number(price) : null,
          payment_mode || null,
          package_type,
          client_location || null,
          incentive_amount,
          screenshot_path,
        ],
      );

      // Email company admin(s) that a new incentive is pending approval.
      try {
        const employeeResult = await query(
          `SELECT u.email AS employee_email, e.first_name, e.last_name
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1 AND e.company_id = $2`,
          [employeeId, req.companyId],
        );
        const employee = employeeResult.rows[0];

        const adminResult = await query(
          `SELECT u.email
           FROM users u
           WHERE u.company_id = $1
             AND u.role IN ('company_admin', 'super_admin')
             AND u.is_active = true`,
          [req.companyId],
        );
        const adminEmails = adminResult.rows.map((r) => r.email).filter(Boolean).join(',');

        if (adminEmails && employee) {
          const submission = result.rows[0];
          await sendEmail({
            to: adminEmails,
            subject: `Incentive pending approval: ${employee.first_name} ${employee.last_name}`,
            text:
              `An incentive submission is pending approval.\n\n` +
              `Employee: ${employee.first_name} ${employee.last_name} (${employee.employee_email})\n` +
              `Client: ${submission.client_name}\n` +
              `Product: ${submission.product_name}\n` +
              `Type: ${submission.package_type}\n` +
              `Quantity: ${submission.sms_quantity ?? 'N/A'}\n` +
              `Rate: ${submission.rate ?? 'N/A'}\n` +
              `Price: ${submission.price ?? 'N/A'}\n` +
              `Payment Mode: ${submission.payment_mode ?? 'N/A'}\n` +
              `Client Mobile 1: ${submission.client_mobile_1 ?? 'N/A'}\n` +
              `Client Mobile 2: ${submission.client_mobile_2 ?? 'N/A'}\n` +
              `Client Email: ${submission.client_email ?? 'N/A'}\n` +
              `Client Username: ${submission.client_username ?? 'N/A'}\n` +
              `Client Location: ${submission.client_location ?? 'N/A'}\n` +
              `Calculated Incentive: ${submission.incentive_amount}\n\n` +
              `Attendify`,
          });
        }
      } catch (emailError) {
        console.error('Incentive submission email send failed', emailError);
      }

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  '/submissions/:id/self',
  authenticate,
  authorize('employee'),
  tenantIsolation,
  requireCompanyContext,
  enforceOfficePunchIpForEmployee,
  uploadIncentiveScreenshot.single('screenshot'),
  async (req, res) => {
    try {
      const submissionId = Number(req.params.id);
      const employeeId = await resolveEmployeeIdForUser(req.user.id);
      if (!employeeId) {
        return res.status(404).json({ message: 'Employee profile not found' });
      }

      const currentResult = await query(
        `SELECT *
         FROM incentive_submissions
         WHERE id = $1::int
           AND company_id = $2::int
           AND employee_id = $3::int`,
        [submissionId, req.companyId, employeeId],
      );
      if (!currentResult.rows.length) {
        return res.status(404).json({ message: 'Incentive submission not found' });
      }
      const current = currentResult.rows[0];
      if (String(current.status) !== 'pending') {
        return res.status(400).json({ message: 'Only pending submissions can be edited.' });
      }

      const allowed = [
        'client_name',
        'product_name',
        'client_mobile_1',
        'client_mobile_2',
        'client_email',
        'client_username',
        'sms_quantity',
        'rate',
        'price',
        'payment_mode',
        'package_type',
        'client_location',
      ];

      const updates = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          updates[key] = req.body[key];
        }
      }

      const next = { ...current, ...updates };

      if (!next.client_name || !next.product_name || !next.package_type) {
        return res.status(400).json({ message: 'Client name, product name, and package type are required.' });
      }
      if (!next.client_mobile_1 || !next.client_email) {
        return res.status(400).json({ message: 'Client mobile number and email are required.' });
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'rate') && updates.rate !== null && updates.rate !== undefined && updates.rate !== '') {
        const rateValue = Number(updates.rate);
        if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue >= 1) {
          return res.status(400).json({ message: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
        }
      }

      const incentive_amount = calculateIncentive(
        String(next.product_name),
        Number(next.sms_quantity),
        Number(next.rate),
        Number(next.price),
        String(next.package_type),
      );

      const screenshot_path = req.file ? toUploadsRelativePath(req.file) : current.screenshot_path;

      const result = await query(
        `UPDATE incentive_submissions
         SET client_name = $1,
             product_name = $2,
             client_mobile_1 = $3,
             client_mobile_2 = $4,
             client_email = $5,
             client_username = $6,
             sms_quantity = $7,
             rate = $8,
             price = $9,
             payment_mode = $10,
             package_type = $11,
             client_location = $12,
             incentive_amount = $13,
             screenshot_path = $14
         WHERE id = $15::int
           AND company_id = $16::int
           AND employee_id = $17::int
         RETURNING *`,
        [
          next.client_name,
          next.product_name,
          next.client_mobile_1,
          next.client_mobile_2 || null,
          next.client_email,
          next.client_username || null,
          next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
          next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
          next.price !== '' && next.price !== null && next.price !== undefined ? Number(next.price) : null,
          next.payment_mode || null,
          next.package_type,
          next.client_location || null,
          incentive_amount,
          screenshot_path,
          submissionId,
          req.companyId,
          employeeId,
        ],
      );

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Employee incentive self-edit failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  '/targets/tiers',
  authenticate,
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const result = await query(
        `SELECT company_id, min_sales_amount, target_total_salary, is_active
         FROM company_sales_target_tiers
         WHERE company_id = $1::int
           AND is_active = TRUE
         ORDER BY min_sales_amount ASC`,
        [req.companyId],
      );
      return res.json(result.rows);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  '/targets/tiers',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const tiers = Array.isArray(req.body?.tiers) ? req.body.tiers : null;
      if (!tiers || !tiers.length) {
        return res.status(400).json({ message: 'tiers[] is required' });
      }

      const normalized = tiers
        .map((t) => ({
          min_sales_amount: Number(t.min_sales_amount),
          target_total_salary: Number(t.target_total_salary),
        }))
        .filter((t) => Number.isFinite(t.min_sales_amount) && t.min_sales_amount >= 0 && Number.isFinite(t.target_total_salary) && t.target_total_salary >= 0)
        .sort((a, b) => a.min_sales_amount - b.min_sales_amount);

      if (!normalized.length) {
        return res.status(400).json({ message: 'tiers[] must contain valid numeric values' });
      }

      await query(
        `UPDATE company_sales_target_tiers
         SET is_active = FALSE,
             updated_at = NOW()
         WHERE company_id = $1::int`,
        [req.companyId],
      );

      for (const tier of normalized) {
        await query(
          `INSERT INTO company_sales_target_tiers (company_id, min_sales_amount, target_total_salary, is_active, created_at, updated_at)
           VALUES ($1::int, $2::decimal(12,2), $3::decimal(10,2), TRUE, NOW(), NOW())
           ON CONFLICT (company_id, min_sales_amount)
           DO UPDATE SET
             target_total_salary = EXCLUDED.target_total_salary,
             is_active = TRUE,
             updated_at = NOW()`,
          [req.companyId, tier.min_sales_amount, tier.target_total_salary],
        );
      }

      const result = await query(
        `SELECT company_id, min_sales_amount, target_total_salary, is_active
         FROM company_sales_target_tiers
         WHERE company_id = $1::int
           AND is_active = TRUE
         ORDER BY min_sales_amount ASC`,
        [req.companyId],
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Target tier update failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  '/targets/monthly',
  authenticate,
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const month = req.query.month ? Number(req.query.month) : (new Date().getMonth() + 1);
      const year = req.query.year ? Number(req.query.year) : (new Date().getFullYear());

      let employeeId = null;
      if (req.user.role === 'employee') {
        employeeId = await resolveEmployeeIdForUser(req.user.id);
      } else {
        employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
      }

      if (req.user.role === 'employee' && !employeeId) {
        return res.json(null);
      }

      const result = await query(
        `SELECT employee_id, month, year, target_sales_amount
         FROM employee_monthly_sales_targets
         WHERE company_id = $1::int
           AND ($2::int IS NULL OR employee_id = $2::int)
           AND month = $3::int
           AND year = $4::int`,
        [req.companyId, employeeId, month, year],
      );

      if (employeeId) {
        return res.json(result.rows[0] || null);
      }
      return res.json(result.rows);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  '/targets/monthly',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const month = Number(req.body?.month);
      const year = Number(req.body?.year);
      const target_sales_amount = Number(req.body?.target_sales_amount);
      const employee_id = req.body?.employee_id ? Number(req.body.employee_id) : null;

      if (!(month >= 1 && month <= 12) || !Number.isInteger(year) || !Number.isFinite(target_sales_amount) || target_sales_amount < 0) {
        return res.status(400).json({ message: 'month (1-12), year, and target_sales_amount are required' });
      }

      let employeeIds = [];
      if (employee_id) {
        employeeIds = [employee_id];
      } else {
        const empResult = await query(
          `SELECT id FROM employees WHERE company_id = $1::int AND status = 'active'`,
          [req.companyId],
        );
        employeeIds = empResult.rows.map((r) => r.id);
      }

      for (const empId of employeeIds) {
        await query(
          `INSERT INTO employee_monthly_sales_targets (company_id, employee_id, month, year, target_sales_amount, set_by, set_at)
           VALUES ($1::int, $2::int, $3::int, $4::int, $5::decimal(12,2), $6::int, NOW())
           ON CONFLICT (company_id, employee_id, month, year)
           DO UPDATE SET
             target_sales_amount = EXCLUDED.target_sales_amount,
             set_by = EXCLUDED.set_by,
             set_at = NOW()`,
          [req.companyId, empId, month, year, target_sales_amount, req.user.id],
        );
      }

      return res.json({ message: 'Monthly targets updated', count: employeeIds.length });
    } catch (error) {
      console.error('Monthly targets update failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  '/performance',
  authenticate,
  tenantIsolation,
  requireCompanyContext,
  enforceOfficePunchIpForEmployee,
  async (req, res) => {
    try {
      const month = req.query.month ? Number(req.query.month) : (new Date().getMonth() + 1);
      const year = req.query.year ? Number(req.query.year) : (new Date().getFullYear());

      let employeeId = null;
      if (req.user.role === 'employee') {
        employeeId = await resolveEmployeeIdForUser(req.user.id);
        if (!employeeId) {
          return res.json({ month, year, summary: null, details: [] });
        }
      } else {
        employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
      }

      if (!employeeId) {
        const list = await query(
          `SELECT
             e.id AS employee_id,
             e.first_name,
             e.last_name,
             e.employee_code,
             COALESCE(COUNT(s.id), 0)::int AS clients_total,
             COALESCE(SUM(s.price), 0)::decimal(12,2) AS sales_total,
             COALESCE(SUM(s.incentive_amount), 0)::decimal(12,2) AS incentives_total,
             COALESCE(COUNT(s.id) FILTER (WHERE s.package_type = 'new'), 0)::int AS new_count,
             COALESCE(COUNT(s.id) FILTER (WHERE s.package_type = 'renew'), 0)::int AS renew_count
           FROM employees e
           LEFT JOIN incentive_submissions s
             ON s.employee_id = e.id
            AND s.company_id = e.company_id
            AND s.status = 'approved'
            AND s.approved_at IS NOT NULL
            AND EXTRACT(MONTH FROM s.approved_at) = $2
            AND EXTRACT(YEAR FROM s.approved_at) = $3
           WHERE e.company_id = $1::int
           GROUP BY e.id
           ORDER BY sales_total DESC`,
          [req.companyId, month, year],
        );

        return res.json({ month, year, employees: list.rows });
      }

      const summaryResult = await query(
        `SELECT
           COALESCE(COUNT(*), 0)::int AS clients_total,
           COALESCE(SUM(price), 0)::decimal(12,2) AS sales_total,
           COALESCE(SUM(incentive_amount), 0)::decimal(12,2) AS incentives_total,
           COALESCE(SUM(sms_quantity), 0)::bigint AS sms_total,
           COALESCE(COUNT(*) FILTER (WHERE package_type = 'new'), 0)::int AS new_count,
           COALESCE(COUNT(*) FILTER (WHERE package_type = 'renew'), 0)::int AS renew_count
         FROM incentive_submissions
         WHERE company_id = $1::int
           AND employee_id = $2::int
           AND status = 'approved'
           AND approved_at IS NOT NULL
           AND EXTRACT(MONTH FROM approved_at) = $3
           AND EXTRACT(YEAR FROM approved_at) = $4`,
        [req.companyId, employeeId, month, year],
      );
      const summary = summaryResult.rows[0];

      const paymentsResult = await query(
        `SELECT COALESCE(payment_mode, 'Unknown') AS payment_mode, COALESCE(SUM(price), 0)::decimal(12,2) AS total
         FROM incentive_submissions
         WHERE company_id = $1::int
           AND employee_id = $2::int
           AND status = 'approved'
           AND approved_at IS NOT NULL
           AND EXTRACT(MONTH FROM approved_at) = $3
           AND EXTRACT(YEAR FROM approved_at) = $4
         GROUP BY COALESCE(payment_mode, 'Unknown')
         ORDER BY total DESC`,
        [req.companyId, employeeId, month, year],
      );

      const detailsResult = await query(
        `SELECT id, client_name, product_name, package_type, payment_mode, price, incentive_amount, sms_quantity, rate, client_location, approved_at, submitted_at
         FROM incentive_submissions
         WHERE company_id = $1::int
           AND employee_id = $2::int
           AND status = 'approved'
           AND approved_at IS NOT NULL
           AND EXTRACT(MONTH FROM approved_at) = $3
           AND EXTRACT(YEAR FROM approved_at) = $4
         ORDER BY approved_at DESC`,
        [req.companyId, employeeId, month, year],
      );

      const targetResult = await query(
        `SELECT target_sales_amount
         FROM employee_monthly_sales_targets
         WHERE company_id = $1::int
           AND employee_id = $2::int
           AND month = $3::int
           AND year = $4::int`,
        [req.companyId, employeeId, month, year],
      );
      const target_sales_amount = targetResult.rows[0]?.target_sales_amount ?? null;

      const tierResult = await query(
        `SELECT min_sales_amount, target_total_salary
         FROM company_sales_target_tiers
         WHERE company_id = $1::int
           AND is_active = TRUE
           AND min_sales_amount <= $2::decimal(12,2)
         ORDER BY min_sales_amount DESC
         LIMIT 1`,
        [req.companyId, summary.sales_total || 0],
      );

      const employeeResult = await query(
        `SELECT id, first_name, last_name, employee_code
         FROM employees
         WHERE id = $1::int AND company_id = $2::int`,
        [employeeId, req.companyId],
      );

      return res.json({
        month,
        year,
        employee: employeeResult.rows[0] || { id: employeeId },
        target_sales_amount,
        tier_applied: tierResult.rows[0] || null,
        summary,
        payment_breakdown: paymentsResult.rows,
        details: detailsResult.rows,
      });
    } catch (error) {
      console.error('Performance fetch failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);
router.put(
  '/submissions/:id',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const submissionId = Number(req.params.id);

      const allowed = [
        'client_name',
        'product_name',
        'client_mobile_1',
        'client_mobile_2',
        'client_email',
        'client_username',
        'sms_quantity',
        'rate',
        'price',
        'payment_mode',
        'package_type',
        'client_location',
        'incentive_amount',
      ];

      const updates = {};
      for (const key of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
          updates[key] = req.body[key];
        }
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ message: 'No fields provided to update.' });
      }

      if (Object.prototype.hasOwnProperty.call(updates, 'rate') && updates.rate !== null && updates.rate !== undefined && updates.rate !== '') {
        const rateValue = Number(updates.rate);
        if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue >= 1) {
          return res.status(400).json({ message: 'Rate must be entered in paisa (example 0.12) and must be less than 1.' });
        }
      }

      const currentResult = await query(
        `SELECT *
         FROM incentive_submissions
         WHERE id = $1::int AND company_id = $2::int`,
        [submissionId, req.companyId],
      );
      if (!currentResult.rows.length) {
        return res.status(404).json({ message: 'Incentive submission not found' });
      }
      const current = currentResult.rows[0];

      const next = { ...current, ...updates };

      const shouldRecalc = !Object.prototype.hasOwnProperty.call(updates, 'incentive_amount');
      const computedIncentive = calculateIncentive(
        String(next.product_name),
        Number(next.sms_quantity),
        Number(next.rate),
        Number(next.price),
        String(next.package_type),
      );

      const finalIncentive = shouldRecalc ? computedIncentive : Number(next.incentive_amount);
      if (!Number.isFinite(finalIncentive) || finalIncentive < 0) {
        return res.status(400).json({ message: 'Incentive amount must be a valid non-negative number.' });
      }

      const result = await query(
        `UPDATE incentive_submissions
         SET client_name = $1,
             product_name = $2,
             client_mobile_1 = $3,
             client_mobile_2 = $4,
             client_email = $5,
             client_username = $6,
             sms_quantity = $7,
             rate = $8,
             price = $9,
             payment_mode = $10,
             package_type = $11,
             client_location = $12,
             incentive_amount = $13
         WHERE id = $14::int
           AND company_id = $15::int
         RETURNING *`,
        [
          next.client_name,
          next.product_name,
          next.client_mobile_1,
          next.client_mobile_2,
          next.client_email,
          next.client_username,
          next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
          next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
          next.price !== '' && next.price !== null && next.price !== undefined ? Number(next.price) : null,
          next.payment_mode,
          next.package_type,
          next.client_location,
          finalIncentive,
          submissionId,
          req.companyId,
        ],
      );

      const updated = result.rows[0];

      try {
        if (updated.status === 'approved' && updated.approved_at) {
          await query(
            `INSERT INTO incentive_earnings (
              company_id, employee_id, submission_id,
              earned_month, earned_year, earned_at,
              client_name, product_name, package_type, payment_mode, price, incentive_amount, client_location,
              submitted_at, approved_by, approved_at
            )
            VALUES (
              $1::int, $2::int, $3::int,
              EXTRACT(MONTH FROM $4::timestamptz)::int,
              EXTRACT(YEAR FROM $4::timestamptz)::int,
              $4::timestamptz,
              $5, $6, $7, $8, $9::decimal(10,2), $10::decimal(10,2), $11,
              $12::timestamptz, $13::int, $14::timestamptz
            )
            ON CONFLICT (submission_id)
            DO UPDATE SET
              earned_month = EXCLUDED.earned_month,
              earned_year = EXCLUDED.earned_year,
              earned_at = EXCLUDED.earned_at,
              client_name = EXCLUDED.client_name,
              product_name = EXCLUDED.product_name,
              package_type = EXCLUDED.package_type,
              payment_mode = EXCLUDED.payment_mode,
              price = EXCLUDED.price,
              incentive_amount = EXCLUDED.incentive_amount,
              client_location = EXCLUDED.client_location,
              approved_by = EXCLUDED.approved_by,
              approved_at = EXCLUDED.approved_at`,
            [
              updated.company_id,
              updated.employee_id,
              updated.id,
              updated.approved_at,
              updated.client_name,
              updated.product_name,
              updated.package_type,
              updated.payment_mode,
              updated.price || 0,
              updated.incentive_amount,
              updated.client_location,
              updated.submitted_at,
              updated.approved_by,
              updated.approved_at,
            ],
          );

          const monthYearResult = await query(
            `SELECT EXTRACT(MONTH FROM $1::timestamptz) AS month, EXTRACT(YEAR FROM $1::timestamptz) AS year`,
            [updated.approved_at],
          );
          const month = Number(monthYearResult.rows[0]?.month);
          const year = Number(monthYearResult.rows[0]?.year);

          const totalResult = await query(
            `SELECT COALESCE(SUM(incentive_amount), 0) AS total
             FROM incentive_submissions
             WHERE employee_id = $1
               AND company_id = $2
               AND status = 'approved'
               AND approved_at IS NOT NULL
               AND EXTRACT(MONTH FROM approved_at) = $3
               AND EXTRACT(YEAR FROM approved_at) = $4`,
            [updated.employee_id, req.companyId, month, year],
          );
          const total = Number(totalResult.rows[0]?.total || 0);
          const payrollResult = await query(
            `SELECT id, basic_salary, total_allowances, total_deductions, late_penalties, early_leave_penalties, working_days, present_days
             FROM payroll_calculations
             WHERE employee_id = $1::int
               AND company_id = $2::int
               AND month = $3::int
               AND year = $4::int
             LIMIT 1`,
            [updated.employee_id, req.companyId, month, year],
          );

          const payroll = payrollResult.rows[0];
          if (payroll) {
            const salesResult = await query(
              `SELECT COALESCE(SUM(price), 0) AS total
               FROM incentive_submissions
               WHERE employee_id = $1
                 AND company_id = $2
                 AND status = 'approved'
                 AND approved_at IS NOT NULL
                 AND EXTRACT(MONTH FROM approved_at) = $3
                 AND EXTRACT(YEAR FROM approved_at) = $4`,
              [updated.employee_id, req.companyId, month, year],
            );

            const salesTotal = Number(salesResult.rows[0]?.total || 0);

            const tierResult = await query(
              `SELECT min_sales_amount, target_total_salary
               FROM company_sales_target_tiers
               WHERE company_id = $1::int
                 AND is_active = TRUE
                 AND min_sales_amount <= $2::decimal(12,2)
               ORDER BY min_sales_amount DESC
               LIMIT 1`,
              [req.companyId, salesTotal],
            );

            const targetTotalSalary = Number(tierResult.rows[0]?.target_total_salary || 0);
            const basicSalary = Number(payroll.basic_salary || 0);
            const workingDays = Number(payroll.working_days || 26);
            const presentDays = Number(payroll.present_days || 0);

            const extraIncome = Math.max(0, targetTotalSalary - basicSalary);
            const earnedBasic = (basicSalary / workingDays) * presentDays;
            const earnedExtra = (extraIncome / workingDays) * presentDays;

            const grossSalary = earnedBasic + earnedExtra + Number(payroll.total_allowances || 0) + total;
            const netSalary = grossSalary - Number(payroll.total_deductions || 0) - Number(payroll.late_penalties || 0) - Number(payroll.early_leave_penalties || 0);

            await query(
              `UPDATE payroll_calculations
               SET incentives = $1::decimal(10,2),
                   sales_total = $2::decimal(12,2),
                   target_total_salary = $3::decimal(10,2),
                   extra_income = $4::decimal(10,2),
                   gross_salary = $5::decimal(10,2),
                   net_salary = $6::decimal(10,2),
                   processed_at = NOW()
               WHERE id = $7::int
                 AND company_id = $8::int`,
              [total, salesTotal, targetTotalSalary, extraIncome, grossSalary, netSalary, payroll.id, req.companyId],
            );
          }
        }
      } catch (syncError) {
        console.error('Incentive edit sync failed', syncError);
      }

      return res.json(updated);
    } catch (error) {
      console.error('Incentive edit failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);
router.put(
  '/submissions/:id/status',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    const { status } = req.body;
    const nextStatus = String(status);

    if (!['approved', 'rejected', 'pending'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Status must be pending, approved, or rejected' });
    }

    try {
      const submissionId = Number(req.params.id);

      const beforeResult = await query(
        `SELECT id, employee_id, company_id, status, approved_at
         FROM incentive_submissions
         WHERE id = $1 AND company_id = $2`,
        [submissionId, req.companyId],
      );
      if (!beforeResult.rows.length) {
        return res.status(404).json({ message: 'Incentive submission not found' });
      }
      const before = beforeResult.rows[0];

      const result = await query(
        `UPDATE incentive_submissions
         SET status = $1::varchar(20),
             approved_by = CASE WHEN $1::varchar(20) = 'approved'::varchar(20) THEN $2::int ELSE NULL END,
             approved_at = CASE WHEN $1::varchar(20) = 'approved'::varchar(20) THEN NOW() ELSE NULL END
         WHERE id = $3::int
           AND company_id = $4::int
         RETURNING *`,
        [nextStatus, req.user.id, submissionId, req.companyId],
      );

      const updated = result.rows[0];

      // Keep monthly earnings table in sync with approved submissions.
      try {
        if (updated.status === 'approved') {
          await query(
            `INSERT INTO incentive_earnings (
              company_id, employee_id, submission_id,
              earned_month, earned_year, earned_at,
              client_name, product_name, package_type, payment_mode, price, incentive_amount, client_location,
              submitted_at, approved_by, approved_at
            )
            SELECT
              s.company_id,
              s.employee_id,
              s.id,
              EXTRACT(MONTH FROM s.approved_at)::int,
              EXTRACT(YEAR FROM s.approved_at)::int,
              s.approved_at,
              s.client_name,
              s.product_name,
              s.package_type,
              s.payment_mode,
              s.price,
              s.incentive_amount,
              s.client_location,
              s.submitted_at,
              s.approved_by,
              s.approved_at
            FROM incentive_submissions s
            WHERE s.id = $1::int
              AND s.company_id = $2::int
              AND s.status = 'approved'
              AND s.approved_at IS NOT NULL
            ON CONFLICT (submission_id)
            DO UPDATE SET
              earned_month = EXCLUDED.earned_month,
              earned_year = EXCLUDED.earned_year,
              earned_at = EXCLUDED.earned_at,
              package_type = EXCLUDED.package_type,
              payment_mode = EXCLUDED.payment_mode,
              price = EXCLUDED.price,
              incentive_amount = EXCLUDED.incentive_amount,
              client_location = EXCLUDED.client_location,
              approved_by = EXCLUDED.approved_by,
              approved_at = EXCLUDED.approved_at`,
            [submissionId, req.companyId],
          );
        } else {
          await query(
            `DELETE FROM incentive_earnings
             WHERE submission_id = $1::int
               AND company_id = $2::int`,
            [submissionId, req.companyId],
          );
        }
      } catch (earnError) {
        console.error('Incentive earnings sync failed', earnError);
      }

      // If payroll for that month was already processed, keep its incentive total in sync.
      try {
        const monthsToSync = [];

        if (before.status === 'approved' && before.approved_at) {
          monthsToSync.push(before.approved_at);
        }
        if (updated.status === 'approved' && updated.approved_at) {
          monthsToSync.push(updated.approved_at);
        }

        for (const stamp of monthsToSync) {
          const monthYearResult = await query(
            `SELECT EXTRACT(MONTH FROM $1::timestamptz) AS month, EXTRACT(YEAR FROM $1::timestamptz) AS year`,
            [stamp],
          );
          const month = Number(monthYearResult.rows[0]?.month);
          const year = Number(monthYearResult.rows[0]?.year);
          if (!month || !year) continue;

          const totalResult = await query(
            `SELECT COALESCE(SUM(incentive_amount), 0) AS total
             FROM incentive_submissions
             WHERE employee_id = $1
               AND company_id = $2
               AND status = 'approved'
               AND approved_at IS NOT NULL
               AND EXTRACT(MONTH FROM approved_at) = $3
               AND EXTRACT(YEAR FROM approved_at) = $4`,
            [updated.employee_id, req.companyId, month, year],
          );
          const total = Number(totalResult.rows[0]?.total || 0);
          const payrollResult = await query(
            `SELECT id, basic_salary, total_allowances, total_deductions, late_penalties, early_leave_penalties, working_days, present_days
             FROM payroll_calculations
             WHERE employee_id = $1::int
               AND company_id = $2::int
               AND month = $3::int
               AND year = $4::int
             LIMIT 1`,
            [updated.employee_id, req.companyId, month, year],
          );

          const payroll = payrollResult.rows[0];
          if (payroll) {
            const salesResult = await query(
              `SELECT COALESCE(SUM(price), 0) AS total
               FROM incentive_submissions
               WHERE employee_id = $1
                 AND company_id = $2
                 AND status = 'approved'
                 AND approved_at IS NOT NULL
                 AND EXTRACT(MONTH FROM approved_at) = $3
                 AND EXTRACT(YEAR FROM approved_at) = $4`,
              [updated.employee_id, req.companyId, month, year],
            );

            const salesTotal = Number(salesResult.rows[0]?.total || 0);

            const tierResult = await query(
              `SELECT min_sales_amount, target_total_salary
               FROM company_sales_target_tiers
               WHERE company_id = $1::int
                 AND is_active = TRUE
                 AND min_sales_amount <= $2::decimal(12,2)
               ORDER BY min_sales_amount DESC
               LIMIT 1`,
              [req.companyId, salesTotal],
            );

            const targetTotalSalary = Number(tierResult.rows[0]?.target_total_salary || 0);
            const basicSalary = Number(payroll.basic_salary || 0);
            const workingDays = Number(payroll.working_days || 26);
            const presentDays = Number(payroll.present_days || 0);

            const extraIncome = Math.max(0, targetTotalSalary - basicSalary);
            const earnedBasic = (basicSalary / workingDays) * presentDays;
            const earnedExtra = (extraIncome / workingDays) * presentDays;

            const grossSalary = earnedBasic + earnedExtra + Number(payroll.total_allowances || 0) + total;
            const netSalary = grossSalary - Number(payroll.total_deductions || 0) - Number(payroll.late_penalties || 0) - Number(payroll.early_leave_penalties || 0);

            await query(
              `UPDATE payroll_calculations
               SET incentives = $1::decimal(10,2),
                   sales_total = $2::decimal(12,2),
                   target_total_salary = $3::decimal(10,2),
                   extra_income = $4::decimal(10,2),
                   gross_salary = $5::decimal(10,2),
                   net_salary = $6::decimal(10,2),
                   processed_at = NOW()
               WHERE id = $7::int
                 AND company_id = $8::int`,
              [total, salesTotal, targetTotalSalary, extraIncome, grossSalary, netSalary, payroll.id, req.companyId],
            );
          }
        }
      } catch (syncError) {
        console.error('Payroll incentive sync failed', syncError);
      }

      return res.json(updated);
    } catch (error) {
      console.error('Incentive status update failed', {
        submissionId: req.params.id,
        companyId: req.companyId,
        userId: req.user?.id,
        role: req.user?.role,
        status: req.body?.status,
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
        constraint: error?.constraint,
        stack: error?.stack,
      });

      const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      return res.status(500).json({
        message: error?.message || 'Internal server error',
        ...(isProd
          ? {}
          : {
              pg: {
                code: error?.code,
                detail: error?.detail,
                hint: error?.hint,
                constraint: error?.constraint,
              },
            }),
      });
    }
  },
);

export default router;






