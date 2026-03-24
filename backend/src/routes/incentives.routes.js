import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { uploadIncentiveScreenshot } from '../middleware/incentive_uploads.js';

const router = express.Router();

const resolveEmployeeIdForUser = async (userId) => {
  const result = await query('SELECT id FROM employees WHERE user_id = $1 LIMIT 1', [userId]);
  return result.rows[0]?.id || null;
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
        else if (rate >= 0.10 && rate <= 0.12) incentive = 1200;
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

router.post('/submissions', authenticate, authorize('employee'), tenantIsolation, uploadIncentiveScreenshot.single('screenshot'), async (req, res) => {
  const {
    client_name,
    product_name,
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

  try {
    const employeeId = await resolveEmployeeIdForUser(req.user.id);
    if (!employeeId) {
      return res.status(404).json({ message: 'Employee profile not found' });
    }

    const incentive_amount = calculateIncentive(product_name, Number(sms_quantity), Number(rate), Number(price), package_type);
    const screenshot_path = req.file ? req.file.path : null;

    const result = await query(
      `INSERT INTO incentive_submissions 
        (company_id, employee_id, client_name, product_name, sms_quantity, rate, price, payment_mode, package_type, client_location, incentive_amount, screenshot_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        req.companyId,
        employeeId,
        client_name,
        product_name,
        sms_quantity ? Number(sms_quantity) : null,
        rate ? Number(rate) : null,
        price ? Number(price) : null,
        payment_mode,
        package_type,
        client_location,
        incentive_amount,
        screenshot_path,
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put('/submissions/:id/status', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(String(status))) {
    return res.status(400).json({ message: 'Status must be pending, approved, or rejected' });
  }

  try {
    const result = await query(
      `UPDATE incentive_submissions
       SET status = $1,
           approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE NULL END,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END
       WHERE id = $3
         AND company_id = $4
       RETURNING *`,
      [String(status), req.user.id, Number(req.params.id), req.companyId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Incentive submission not found' });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
