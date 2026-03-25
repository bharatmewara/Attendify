import express from 'express';
import path from 'path';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
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

router.get('/submissions', authenticate, tenantIsolation, async (req, res) => {
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

router.get('/earnings', authenticate, tenantIsolation, async (req, res) => {
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

          await query(
            `UPDATE payroll_calculations
             SET incentives = $1::decimal(10,2),
                 gross_salary = (gross_salary - incentives + $1::decimal(10,2)),
                 net_salary = (net_salary - incentives + $1::decimal(10,2)),
                 processed_at = NOW()
             WHERE employee_id = $2::int
               AND company_id = $3::int
               AND month = $4::int
               AND year = $5::int`,
            [total, updated.employee_id, req.companyId, month, year],
          );
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