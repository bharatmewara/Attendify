import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';
import { uploadCompany } from '../middleware/uploads.js';

const router = express.Router();

// Get departments
router.get('/departments', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM departments WHERE ($1::int IS NULL OR company_id = $1) AND is_active = true ORDER BY name',
      [req.companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create department
router.post('/departments', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { name, description } = req.body;

  try {
    const result = await query(
      'INSERT INTO departments (company_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.companyId, name, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update department
router.put('/departments/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { name, description, is_active } = req.body;

  try {
    const result = await query(
      'UPDATE departments SET name = $1, description = $2, is_active = $3 WHERE id = $4 AND ($5::int IS NULL OR company_id = $5) RETURNING *',
      [name, description, is_active, req.params.id, req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get designations
router.get('/designations', authenticate, tenantIsolation, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM designations WHERE ($1::int IS NULL OR company_id = $1) AND is_active = true ORDER BY title',
      [req.companyId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create designation
router.post('/designations', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, requireCompanyContext, async (req, res) => {
  const { title, description } = req.body;

  try {
    const result = await query(
      'INSERT INTO designations (company_id, title, description) VALUES ($1, $2, $3) RETURNING *',
      [req.companyId, title, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update designation
router.put('/designations/:id', authenticate, authorize('company_admin', 'super_admin'), tenantIsolation, async (req, res) => {
  const { title, description, is_active } = req.body;

  try {
    const result = await query(
      'UPDATE designations SET title = $1, description = $2, is_active = $3 WHERE id = $4 AND ($5::int IS NULL OR company_id = $5) RETURNING *',
      [title, description, is_active, req.params.id, req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Designation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get own company details (for company admin)
router.get('/companies', authenticate, tenantIsolation, async (req, res) => {
  try {
    if (!req.companyId) {
      return res.status(400).json({ message: 'Company context required' });
    }
  const result = await query(`
      SELECT id, company_name, COALESCE(logo, '') as logo, COALESCE(address, '') as address, COALESCE(tel_no, '') as tel_no, COALESCE(phone, '') as phone, email, COALESCE(notification_emails, '') as notification_emails, COALESCE(website, '') as website, COALESCE(industry, '') as industry, subscription_status
      FROM companies 
      WHERE id = $1
    `, [req.companyId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update own company details (company admin)
router.patch('/companies', authenticate, authorize('company_admin'), tenantIsolation, requireCompanyContext, uploadCompany.single('logo'), async (req, res) => {
  const { company_name, address, tel_no, phone, email, notification_emails, website } = req.body;
  let logo = null;

  try {
    // Handle logo upload
    if (req.file) {
      logo = `/uploads/logos/${req.file.filename}`;
    } else if (req.body.logo) {
      logo = req.body.logo; // URL only
    }

    // Build dynamic update
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (company_name !== undefined) {
      fields.push(`company_name = $${paramIndex}`);
      values.push(company_name);
      paramIndex++;
    }
    if (address !== undefined) {
      fields.push(`address = $${paramIndex}`);
      values.push(address);
      paramIndex++;
    }
    if (tel_no !== undefined) {
      fields.push(`tel_no = $${paramIndex}`);
      values.push(tel_no);
      paramIndex++;
    }
    if (phone !== undefined) {
      fields.push(`phone = $${paramIndex}`);
      values.push(phone);
      paramIndex++;
    }
    if (email !== undefined) {
      fields.push(`email = $${paramIndex}`);
      values.push(email);
      paramIndex++;
    }
    if (notification_emails !== undefined) {
      fields.push(`notification_emails = $${paramIndex}`);
      values.push(notification_emails);
      paramIndex++;
    }
    if (website !== undefined) {
      fields.push(`website = $${paramIndex}`);
      values.push(website);
      paramIndex++;
    }
    if (logo !== null) {
      fields.push(`logo = $${paramIndex}`);
      values.push(logo);
      paramIndex++;
    }
    if (req.body.letter_accent_color !== undefined) {
      fields.push(`letter_accent_color = $${paramIndex}`);
      values.push(req.body.letter_accent_color);
      paramIndex++;
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    fields.push('updated_at = NOW()');
    values.push(req.companyId);

    const result = await query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
