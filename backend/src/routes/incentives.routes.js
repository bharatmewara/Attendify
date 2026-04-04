import express from 'express';
import path from 'path';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { enforceOfficePunchIpForEmployee } from '../middleware/networkPolicy.js';
import { uploadIncentiveScreenshot } from '../middleware/incentive_uploads.js';
import { sendEmail } from '../utils/email.js';
import {
  calculateIncentiveFromRules,
  defaultIncentiveRulesConfigV1,
  getActiveProductNamesFromRules,
  isProductActiveInRules,
  validateIncentiveRulesConfigV1,
} from '../utils/incentive_rules.js';

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

const GST_RATE = 0.18;

const normalizeBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return Boolean(value);
  const str = String(value ?? '').trim().toLowerCase();
  if (!str) return false;
  if (['true', '1', 'yes', 'y', 'on'].includes(str)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(str)) return false;
  return false;
};

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

const resolvePricingWithGst = ({ packageType, gstApplied, price, priceGross }) => {
  const isCurrent = String(packageType || '').toLowerCase() === 'new';
  const applyGst = isCurrent && normalizeBoolean(gstApplied);

  const grossCandidate = priceGross !== undefined && priceGross !== null && priceGross !== ''
    ? Number(priceGross)
    : (price !== undefined && price !== null && price !== '' ? Number(price) : null);

  if (applyGst && grossCandidate !== null && Number.isFinite(grossCandidate) && grossCandidate >= 0) {
    const net = roundMoney(grossCandidate / (1 + GST_RATE));
    return { gst_applied: true, price_gross: roundMoney(grossCandidate), price: net };
  }

  const netCandidate = price !== undefined && price !== null && price !== '' ? Number(price) : null;
  return {
    gst_applied: false,
    price_gross: null,
    price: netCandidate !== null && Number.isFinite(netCandidate) ? roundMoney(netCandidate) : null,
  };
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const fmtMoney = (value) => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (!Number.isFinite(num)) return escapeHtml(value);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const buildEmailHtml = ({ title, subtitle, sections = [], note }) => {
  const sectionHtml = sections
    .map((section) => {
      const rows = (section.rows || [])
        .map(
          (r) => `
            <tr>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:700;width:220px;">${escapeHtml(r.label)}</td>
              <td style="padding:10px 12px;border:1px solid #e5e7eb;">${r.htmlValue ?? escapeHtml(r.value ?? '')}</td>
            </tr>`,
        )
        .join('');

      return `
        <div style="margin-top:14px;">
          <div style="font-weight:900;color:#111827;margin:0 0 8px 0;font-size:14px;">${escapeHtml(section.title || '')}</div>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
            ${rows}
          </table>
        </div>`;
    })
    .join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;padding:24px;">
      <div style="max-width:820px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="padding:18px 20px;background:#111827;color:#fff;">
          <div style="font-size:18px;font-weight:900;line-height:1.2;">${escapeHtml(title || '')}</div>
          ${subtitle ? `<div style="opacity:.9;margin-top:6px;font-size:13px;">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div style="padding:18px 20px;">
          ${sectionHtml}
          ${note ? `<div style="margin-top:14px;padding:12px 14px;border-radius:10px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;font-size:13px;">${escapeHtml(note)}</div>` : ''}
          <div style="margin-top:16px;color:#6b7280;font-size:12px;">Attendify</div>
        </div>
      </div>
    </div>`;
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
const getCompanyIncentiveRulesConfig = async (companyId) => {
  try {
    const result = await query(
      `SELECT config
       FROM company_incentive_rules
       WHERE company_id = $1::int
         AND is_active = TRUE
       LIMIT 1`,
      [companyId],
    );
    return result.rows[0]?.config || null;
  } catch (error) {
    console.error('Incentive rules fetch failed', error);
    return null;
  }
};

const calculateCompanyIncentiveAmount = async ({
  companyId,
  productName,
  smsQuantity,
  rate,
  price,
  packageType,
}) => {
  const config = await getCompanyIncentiveRulesConfig(companyId);
  const fromRules = calculateIncentiveFromRules({
    config,
    productName,
    smsQuantity,
    rate,
    price,
    packageType,
  });

  if (fromRules !== null && fromRules !== undefined) {
    return { incentive: fromRules, config };
  }

  // fallback to legacy hardcoded rules
  const legacy = calculateIncentive(productName, smsQuantity, rate, price, packageType);
  return { incentive: legacy, config };
};

router.get(
  '/rules',
  authenticate,
  async (req, res) => {
    try {
      const companyId = req.user.company_id || req.auth?.companyId || null;
      const config = companyId ? await getCompanyIncentiveRulesConfig(Number(companyId)) : null;
      if (config) return res.json({ source: 'db', config });
      return res.json({ source: 'default', config: defaultIncentiveRulesConfigV1() });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  '/rules',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const config = req.body?.config;
      const validation = validateIncentiveRulesConfigV1(config);
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message || 'Invalid config.' });
      }

      await query(
        `INSERT INTO company_incentive_rules (company_id, config, is_active, created_at, updated_at)
         VALUES ($1::int, $2::jsonb, TRUE, NOW(), NOW())
         ON CONFLICT (company_id)
         DO UPDATE SET
           config = EXCLUDED.config,
           is_active = TRUE,
           updated_at = NOW()`,
        [req.companyId, JSON.stringify(config)],
      );

      return res.json({ message: 'Incentive rules saved', config });
    } catch (error) {
      console.error('Incentive rules save failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  '/products',
  authenticate,
  tenantIsolation,
  requireCompanyContext,
  enforceOfficePunchIpForEmployee,
  async (req, res) => {
    try {
      const config = await getCompanyIncentiveRulesConfig(req.companyId);
      const products = getActiveProductNamesFromRules(config);
      if (products.length) return res.json(products);
      return res.json(defaultIncentiveRulesConfigV1().products.map((p) => p.name));
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  '/preview',
  authenticate,
  authorize('employee'),
  tenantIsolation,
  requireCompanyContext,
  enforceOfficePunchIpForEmployee,
  async (req, res) => {
    try {
      const product_name = req.body?.product_name;
      const package_type = req.body?.package_type;
      const sms_quantity = req.body?.sms_quantity;
      const rate = req.body?.rate;
      const price = req.body?.price;
      const gst_applied = req.body?.gst_applied;
      const price_gross = req.body?.price_gross;

      if (!product_name || !package_type) {
        return res.status(400).json({ message: 'product_name and package_type are required.' });
      }

      const resolvedPricing = resolvePricingWithGst({
        packageType: package_type,
        gstApplied: gst_applied,
        price,
        priceGross: price_gross,
      });

      const { incentive } = await calculateCompanyIncentiveAmount({
        companyId: req.companyId,
        productName: product_name,
        smsQuantity: sms_quantity ? Number(sms_quantity) : null,
        rate: rate === '' || rate === null || rate === undefined ? null : Number(rate),
        price: resolvedPricing.price,
        packageType: package_type,
      });

      return res.json({
        incentive_amount: Number(incentive || 0),
        price: resolvedPricing.price,
        price_gross: resolvedPricing.price_gross,
        gst_applied: resolvedPricing.gst_applied,
      });
    } catch (error) {
      console.error('Incentive preview failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);
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
    if (employeeId) {
      for (const r of result.rows) {
        delete r.client_panel_password;
      }
    }
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
      client_panel_username,
      client_panel_password,
      sms_quantity,
      rate,
      gst_applied,
      price_gross,
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

      const productActive = isProductActiveInRules(await getCompanyIncentiveRulesConfig(req.companyId), product_name);
      if (productActive === false) {
        return res.status(400).json({ message: 'This product is disabled by admin.' });
      }

      const resolvedPricing = resolvePricingWithGst({
        packageType: package_type,
        gstApplied: gst_applied,
        price,
        priceGross: price_gross,
      });

      const { incentive: incentive_amount } = await calculateCompanyIncentiveAmount({
        companyId: req.companyId,
        productName: product_name,
        smsQuantity: sms_quantity ? Number(sms_quantity) : null,
        rate: rate === '' || rate === null || rate === undefined ? null : Number(rate),
        price: resolvedPricing.price,
        packageType: package_type,
      });
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
      client_panel_username,
      client_panel_password,
      sms_quantity,
            rate,
            gst_applied,
            price_gross,
            price,
            payment_mode,
            package_type,
            client_location,
            incentive_amount,
            screenshot_path
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
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
          client_panel_username ? String(client_panel_username) : null,
          client_panel_password ? String(client_panel_password) : null,
          sms_quantity ? Number(sms_quantity) : null,
          rate ? Number(rate) : null,
          resolvedPricing.gst_applied,
          resolvedPricing.price_gross,
          resolvedPricing.price,
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

        const companyResult = await query(
          `SELECT email, notification_emails
           FROM companies
           WHERE id = $1::int
           LIMIT 1`,
          [req.companyId],
        );
        const companyRow = companyResult.rows[0] || {};
        const configuredRecipients = String(companyRow.notification_emails || '').trim();
        let adminEmails = configuredRecipients || String(companyRow.email || '').trim();

        if (!adminEmails) {
          const adminResult = await query(
            `SELECT u.email
             FROM users u
             WHERE u.company_id = $1
               AND u.role IN ('company_admin', 'super_admin')
               AND u.is_active = true`,
            [req.companyId],
          );
          adminEmails = adminResult.rows.map((r) => r.email).filter(Boolean).join(',');
        }

        if (adminEmails && employee) {
          const submission = result.rows[0];
          const employeeName = `${employee.first_name} ${employee.last_name}`.trim();
          const net = submission.price ?? null;
          const gross = submission.gst_applied && submission.price_gross ? submission.price_gross : null;
          const amountReceived = gross ?? net;
          const gstAmount =
            gross !== null && net !== null
              ? roundMoney(Number(gross) - Number(net))
              : null;
          await sendEmail({
            to: adminEmails,
            subject: `Today Status - ${employeeName}`,
            text:
              `An incentive submission is pending approval.\n\n` +
              `Employee: ${employee.first_name} ${employee.last_name} (${employee.employee_email})\n` +
              `Client: ${submission.client_name}\n` +
              `Product: ${submission.product_name}\n` +
              `Type: ${submission.package_type}\n` +
              `Quantity: ${submission.sms_quantity ?? 'N/A'}\n` +
              `Rate: ${submission.rate ?? 'N/A'}\n` +
              `Price (excl GST): ${submission.price ?? 'N/A'}\n` +
              (submission.gst_applied && submission.price_gross ? `Price (incl GST): ${submission.price_gross}\n` : '') +
              `Payment Mode: ${submission.payment_mode ?? 'N/A'}\n` +
              `Client Mobile 1: ${submission.client_mobile_1 ?? 'N/A'}\n` +
              `Client Mobile 2: ${submission.client_mobile_2 ?? 'N/A'}\n` +
              `Client Email: ${submission.client_email ?? 'N/A'}\n` +
              `Client Username: ${submission.client_username ?? 'N/A'}\n` +
              `Client Location: ${submission.client_location ?? 'N/A'}\n` +
              `Calculated Incentive: ${submission.incentive_amount}\n\n` +
              `Attendify`,
            html: buildEmailHtml({
              title: 'Incentive Submission',
              subtitle: employeeName,
              sections: [
                {
                  title: 'Incentive Details',
                  rows: [
                    { label: 'Product', value: submission.product_name },
                    { label: 'Type', value: submission.package_type },
                    { label: 'SMS Quantity', value: submission.sms_quantity ?? 'N/A' },
                    { label: 'Rate', value: submission.rate ?? 'N/A' },
                    { label: 'Price (excl GST)', htmlValue: `₹ ${fmtMoney(net)}` },
                    { label: 'GST (18%)', htmlValue: gstAmount !== null ? `₹ ${fmtMoney(gstAmount)}` : 'N/A' },
                    { label: 'Amount Received (incl GST)', htmlValue: amountReceived !== null ? `₹ ${fmtMoney(amountReceived)}` : 'N/A' },
                    { label: 'Payment Mode', value: submission.payment_mode ?? 'N/A' },
                    { label: 'Incentive', htmlValue: `₹ ${fmtMoney(submission.incentive_amount)}` },
                  ],
                },
                {
                  title: 'Client Details',
                  rows: [
                    { label: 'Client', value: submission.client_name },
                    { label: 'Mobile', value: [submission.client_mobile_1, submission.client_mobile_2].filter(Boolean).join(', ') || 'N/A' },
                    { label: 'Email', value: submission.client_email ?? 'N/A' },
                    { label: 'Panel User', value: submission.client_panel_username ?? 'N/A' },
                    { label: 'Panel Pass', value: submission.client_panel_password ?? 'N/A' },
                    { label: 'Username', value: submission.client_username ?? 'N/A' },
                    { label: 'Location', value: submission.client_location ?? 'N/A' },
                  ],
                },
              ],
            }),
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
        'client_panel_username',
        'client_panel_password',
        'sms_quantity',
        'rate',
        'gst_applied',
        'price_gross',
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
      const productActive = isProductActiveInRules(await getCompanyIncentiveRulesConfig(req.companyId), next.product_name);
      if (productActive === false) {
        return res.status(400).json({ message: 'This product is disabled by admin.' });
      }

      const resolvedPricing = resolvePricingWithGst({
        packageType: next.package_type,
        gstApplied: next.gst_applied,
        price: next.price,
        priceGross: next.price_gross,
      });

      const { incentive: incentive_amount } = await calculateCompanyIncentiveAmount({
        companyId: req.companyId,
        productName: String(next.product_name),
        smsQuantity: next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
        rate: next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
        price: resolvedPricing.price,
        packageType: String(next.package_type),
      });

      const screenshot_path = req.file ? toUploadsRelativePath(req.file) : current.screenshot_path;

      const result = await query(
        `UPDATE incentive_submissions
         SET client_name = $1,
             product_name = $2,
             client_mobile_1 = $3,
             client_mobile_2 = $4,
             client_email = $5,
             client_username = $6,
             client_panel_username = $7,
             client_panel_password = $8,
             sms_quantity = $9,
             rate = $10,
             gst_applied = $11,
             price_gross = $12,
             price = $13,
             payment_mode = $14,
             package_type = $15,
             client_location = $16,
             incentive_amount = $17,
             screenshot_path = $18
         WHERE id = $19::int
           AND company_id = $20::int
           AND employee_id = $21::int
         RETURNING *`,
        [
          next.client_name,
          next.product_name,
          next.client_mobile_1,
          next.client_mobile_2 || null,
          next.client_email,
          next.client_username || null,
          next.client_panel_username || null,
          next.client_panel_password || null,
          next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
          next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
          resolvedPricing.gst_applied,
          resolvedPricing.price_gross,
          resolvedPricing.price,
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
        `SELECT
           id,
           client_name,
           product_name,
           package_type,
           payment_mode,
           sms_quantity,
           rate,
           price,
           incentive_amount,
           client_location,
           client_mobile_1,
           client_mobile_2,
           client_email,
           client_panel_username,
           client_panel_password,
           approved_at,
           submitted_at
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
      const targetSalesValue = target_sales_amount !== null && target_sales_amount !== undefined && target_sales_amount !== ''
        ? Number(target_sales_amount)
        : null;

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

      const tierAtTargetResult =
        targetSalesValue !== null && Number.isFinite(targetSalesValue)
          ? await query(
              `SELECT min_sales_amount, target_total_salary
               FROM company_sales_target_tiers
               WHERE company_id = $1::int
                 AND is_active = TRUE
                 AND min_sales_amount <= $2::decimal(12,2)
               ORDER BY min_sales_amount DESC
               LIMIT 1`,
              [req.companyId, targetSalesValue],
            )
          : { rows: [] };

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
        tier_at_target: tierAtTargetResult.rows[0] || null,
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

router.get(
  '/performance/history',
  authenticate,
  authorize('employee', 'company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  enforceOfficePunchIpForEmployee,
  async (req, res) => {
    try {
      const monthsBackRaw = req.query.months_back ?? req.query.monthsBack ?? 6;
      const monthsBack = Math.max(1, Math.min(24, Number(monthsBackRaw) || 6));

      let employeeId = null;
      if (req.user.role === 'employee') {
        employeeId = await resolveEmployeeIdForUser(req.user.id);
        if (!employeeId) {
          return res.json({ months_back: monthsBack, groups: [] });
        }
      } else {
        employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
      }

      if (!employeeId) {
        return res.status(400).json({ message: 'employee_id is required' });
      }

      const rowsResult = await query(
        `SELECT
           EXTRACT(YEAR FROM approved_at)::int AS year,
           EXTRACT(MONTH FROM approved_at)::int AS month,
           id,
           client_name,
           product_name,
           package_type,
           payment_mode,
           sms_quantity,
           rate,
           price,
           incentive_amount,
           client_location,
           client_mobile_1,
           client_mobile_2,
           client_email,
           client_panel_username,
           client_panel_password,
           approved_at
         FROM incentive_submissions
         WHERE company_id = $1::int
           AND employee_id = $2::int
           AND status = 'approved'
           AND approved_at >= (date_trunc('month', NOW()) - (($3::int - 1) * INTERVAL '1 month'))
           AND approved_at IS NOT NULL
         ORDER BY approved_at DESC
         LIMIT 5000`,
        [req.companyId, employeeId, monthsBack],
      );

      const groupsMap = new Map();
      for (const row of rowsResult.rows) {
        const key = `${row.year}-${row.month}`;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            year: row.year,
            month: row.month,
            summary: {
              clients_total: 0,
              sales_total: 0,
              incentives_total: 0,
              sms_total: 0,
            },
            details: [],
          });
        }
        const group = groupsMap.get(key);
        group.details.push(row);
        group.summary.clients_total += 1;
        group.summary.sales_total += Number(row.price || 0);
        group.summary.incentives_total += Number(row.incentive_amount || 0);
        group.summary.sms_total += Number(row.sms_quantity || 0);
      }

      const groups = Array.from(groupsMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

      return res.json({ months_back: monthsBack, groups });
    } catch (error) {
      console.error('Performance history fetch failed', error);
      return res.status(500).json({ message: error.message });
    }
  },
);
router.get(
  '/clients',
  authenticate,
  authorize('company_admin', 'super_admin'),
  tenantIsolation,
  requireCompanyContext,
  async (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q).trim() : '';
      const date_from_raw = req.query.date_from ?? req.query.dateFrom ?? '';
      const date_to_raw = req.query.date_to ?? req.query.dateTo ?? '';
      const date_from = date_from_raw ? String(date_from_raw).trim() : '';
      const date_to = date_to_raw ? String(date_to_raw).trim() : '';

      const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
      if (date_from && !isIsoDate(date_from)) {
        return res.status(400).json({ message: 'date_from must be in YYYY-MM-DD format.' });
      }
      if (date_to && !isIsoDate(date_to)) {
        return res.status(400).json({ message: 'date_to must be in YYYY-MM-DD format.' });
      }

      const result = await query(
        `WITH base AS (
          SELECT
            COALESCE(NULLIF(client_mobile_1, ''), NULLIF(client_email, ''), CONCAT('submission:', id::text)) AS client_key,
            *
          FROM incentive_submissions
          WHERE company_id = $1::int
            AND ($3::date IS NULL OR COALESCE(approved_at::date, submitted_at::date) >= $3::date)
            AND ($4::date IS NULL OR COALESCE(approved_at::date, submitted_at::date) <= $4::date)
        ),
        ranked AS (
          SELECT
            b.*, 
            ROW_NUMBER() OVER (
              PARTITION BY b.client_key
              ORDER BY b.approved_at DESC NULLS LAST, b.submitted_at DESC
            ) AS rn
          FROM base b
        ),
        agg AS (
          SELECT
            client_key,
            COUNT(*)::int AS submissions_count,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved_count,
            COALESCE(SUM(price) FILTER (WHERE status = 'approved'), 0)::decimal(12,2) AS total_sales,
            COALESCE(
              SUM(
                CASE
                  WHEN gst_applied = TRUE AND price_gross IS NOT NULL THEN price_gross
                  ELSE price
                END
              ) FILTER (WHERE status = 'approved'),
              0
            )::decimal(12,2) AS total_received,
            COALESCE(
              SUM(
                CASE
                  WHEN gst_applied = TRUE AND price_gross IS NOT NULL AND price IS NOT NULL THEN (price_gross - price)
                  ELSE 0
                END
              ) FILTER (WHERE status = 'approved'),
              0
            )::decimal(12,2) AS total_gst_amount,
            COALESCE(SUM(incentive_amount) FILTER (WHERE status = 'approved'), 0)::decimal(12,2) AS total_incentive
          FROM ranked
          GROUP BY client_key
        )
        SELECT
          r.client_key,
          r.client_name,
          r.client_mobile_1,
          r.client_mobile_2,
          r.client_email,
          r.client_username,
          r.client_panel_username,
          r.client_panel_password,
          r.product_name AS last_product,
          r.sms_quantity AS last_sms_quantity,
          r.gst_applied AS last_gst_applied,
          r.price AS last_price_ex_gst,
          r.price_gross AS last_price_inc_gst,
          CASE
            WHEN r.gst_applied = TRUE AND r.price_gross IS NOT NULL THEN r.price_gross
            ELSE r.price
          END AS last_amount_received,
          CASE
            WHEN r.gst_applied = TRUE AND r.price_gross IS NOT NULL AND r.price IS NOT NULL THEN (r.price_gross - r.price)
            ELSE NULL
          END AS last_gst_amount,
          r.payment_mode AS last_payment_mode,
          r.client_location AS last_location,
          r.status AS last_status,
          r.approved_at AS last_approved_at,
          r.submitted_at AS last_submitted_at,
          e.first_name,
          e.last_name,
          e.employee_code,
          a.submissions_count,
          a.approved_count,
          a.total_sales,
          a.total_received,
          a.total_gst_amount,
          a.total_incentive
        FROM ranked r
        JOIN agg a ON a.client_key = r.client_key
        LEFT JOIN employees e ON e.id = r.employee_id
        WHERE r.rn = 1
          AND (
            $2::text = ''
            OR COALESCE(r.client_name, '') ILIKE ('%' || $2::text || '%')
            OR COALESCE(r.client_mobile_1, '') ILIKE ('%' || $2::text || '%')
            OR COALESCE(r.client_email, '') ILIKE ('%' || $2::text || '%')
            OR COALESCE(r.client_username, '') ILIKE ('%' || $2::text || '%')
            OR COALESCE(r.client_panel_username, '') ILIKE ('%' || $2::text || '%')
          )
        ORDER BY COALESCE(r.approved_at, r.submitted_at) DESC
        LIMIT 500`,
        [req.companyId, q, date_from || null, date_to || null],
      );

      return res.json(result.rows);
    } catch (error) {
      console.error('Clients list fetch failed', error);
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
        'client_panel_username',
        'client_panel_password',
        'sms_quantity',
        'rate',
        'gst_applied',
        'price_gross',
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

      const productActive = isProductActiveInRules(await getCompanyIncentiveRulesConfig(req.companyId), next.product_name);
      if (productActive === false) {
        return res.status(400).json({ message: 'This product is disabled by admin.' });
      }

      const resolvedPricing = resolvePricingWithGst({
        packageType: next.package_type,
        gstApplied: next.gst_applied,
        price: next.price,
        priceGross: next.price_gross,
      });

      let computedIncentive = 0;
      if (shouldRecalc) {
        const { incentive } = await calculateCompanyIncentiveAmount({
          companyId: req.companyId,
          productName: String(next.product_name),
          smsQuantity: next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
          rate: next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
          price: resolvedPricing.price,
          packageType: String(next.package_type),
        });
        computedIncentive = Number(incentive || 0);
      }

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
             client_panel_username = $7,
             client_panel_password = $8,
             sms_quantity = $9,
             rate = $10,
             gst_applied = $11,
             price_gross = $12,
             price = $13,
             payment_mode = $14,
             package_type = $15,
             client_location = $16,
             incentive_amount = $17
         WHERE id = $18::int
           AND company_id = $19::int
         RETURNING *`,
        [
          next.client_name,
          next.product_name,
          next.client_mobile_1,
          next.client_mobile_2,
          next.client_email,
          next.client_username,
          next.client_panel_username,
          next.client_panel_password,
          next.sms_quantity !== '' && next.sms_quantity !== null && next.sms_quantity !== undefined ? Number(next.sms_quantity) : null,
          next.rate !== '' && next.rate !== null && next.rate !== undefined ? Number(next.rate) : null,
          resolvedPricing.gst_applied,
          resolvedPricing.price_gross,
          resolvedPricing.price,
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
              client_name, product_name, package_type, payment_mode, sms_quantity, price, incentive_amount, client_location,
              submitted_at, approved_by, approved_at
            )
            VALUES (
              $1::int, $2::int, $3::int,
              EXTRACT(MONTH FROM $4::timestamptz)::int,
              EXTRACT(YEAR FROM $4::timestamptz)::int,
              $4::timestamptz,
              $5, $6, $7, $8, $9::int, $10::decimal(10,2), $11::decimal(10,2), $12,
              $13::timestamptz, $14::int, $15::timestamptz
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
              sms_quantity = EXCLUDED.sms_quantity,
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
              updated.sms_quantity || null,
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

    if (!['approved', 'rejected', 'pending', 'refunded'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Status must be pending, approved, rejected, or refunded' });
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
              client_name, product_name, package_type, payment_mode, sms_quantity, price, incentive_amount, client_location,
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
              s.sms_quantity,
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
              sms_quantity = EXCLUDED.sms_quantity,
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

      // Email employee + company recipients about status change.
      try {
        const employeeResult = await query(
          `SELECT u.email AS employee_email, e.first_name, e.last_name
           FROM employees e
           JOIN users u ON e.user_id = u.id
           WHERE e.id = $1::int AND e.company_id = $2::int`,
          [updated.employee_id, req.companyId],
        );
        const employee = employeeResult.rows[0];

        const companyResult = await query(
          `SELECT email, notification_emails
           FROM companies
           WHERE id = $1::int
           LIMIT 1`,
          [req.companyId],
        );
        const companyRow = companyResult.rows[0] || {};
        const configuredRecipients = String(companyRow.notification_emails || '').trim();
        const companyRecipients = configuredRecipients || String(companyRow.email || '').trim();

        const statusLabel = String(updated.status || '').toUpperCase();
        const employeeName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Employee';
        const subject = `Today Status - ${employeeName}`;
        const body =
          `Incentive submission status changed.\n\n` +
          `Status: ${updated.status}\n` +
          `Client: ${updated.client_name ?? 'N/A'}\n` +
          `Product: ${updated.product_name ?? 'N/A'}\n` +
          `Type: ${updated.package_type ?? 'N/A'}\n` +
          `Price (excl GST): ${updated.price ?? 'N/A'}\n` +
          (updated.gst_applied && updated.price_gross ? `Price (incl GST): ${updated.price_gross}\n` : '') +
          `Incentive: ${updated.incentive_amount ?? 'N/A'}\n\n` +
          (String(updated.status).toLowerCase() === 'refunded'
            ? 'Note: Refunded incentives are removed from totals and payroll calculations.'
            : '') +
          `\n\nAttendify`;

        const net = updated.price ?? null;
        const gross = updated.gst_applied && updated.price_gross ? updated.price_gross : null;
        const amountReceived = gross ?? net;
        const gstAmount =
          gross !== null && net !== null
            ? roundMoney(Number(gross) - Number(net))
            : null;
        const note = String(updated.status).toLowerCase() === 'refunded'
          ? 'Refunded incentives are removed from totals and payroll calculations.'
          : '';

        const html = buildEmailHtml({
          title: `Incentive Status: ${statusLabel}`,
          subtitle: employeeName,
          sections: [
            {
              title: 'Incentive Details',
              rows: [
                { label: 'Status', value: updated.status },
                { label: 'Client', value: updated.client_name ?? 'N/A' },
                { label: 'Product', value: updated.product_name ?? 'N/A' },
                { label: 'Type', value: updated.package_type ?? 'N/A' },
                { label: 'SMS Quantity', value: updated.sms_quantity ?? 'N/A' },
                { label: 'Price (excl GST)', htmlValue: `₹ ${fmtMoney(net)}` },
                { label: 'GST (18%)', htmlValue: gstAmount !== null ? `₹ ${fmtMoney(gstAmount)}` : 'N/A' },
                { label: 'Amount Received (incl GST)', htmlValue: amountReceived !== null ? `₹ ${fmtMoney(amountReceived)}` : 'N/A' },
                { label: 'Incentive', htmlValue: `₹ ${fmtMoney(updated.incentive_amount ?? 'N/A')}` },
              ],
            },
            {
              title: 'Client Details',
              rows: [
                { label: 'Mobile', value: [updated.client_mobile_1, updated.client_mobile_2].filter(Boolean).join(', ') || 'N/A' },
                { label: 'Email', value: updated.client_email ?? 'N/A' },
                { label: 'Panel User', value: updated.client_panel_username ?? 'N/A' },
                { label: 'Panel Pass', value: updated.client_panel_password ?? 'N/A' },
                { label: 'Location', value: updated.client_location ?? 'N/A' },
              ],
            },
          ],
          note: note || null,
        });

        if (employee?.employee_email) {
          await sendEmail({ to: employee.employee_email, subject, text: body, html });
        }
        if (companyRecipients) {
          await sendEmail({ to: companyRecipients, subject, text: body, html });
        }
      } catch (emailError) {
        console.error('Incentive status email send failed', emailError);
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



















