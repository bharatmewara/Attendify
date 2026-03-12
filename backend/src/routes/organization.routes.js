import express from 'express';
import { query } from '../db.js';
import { authenticate, authorize, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';

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

export default router;
