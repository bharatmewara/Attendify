import express from 'express';
import { query } from '../db.js';
import { authenticate, requireCompanyContext, tenantIsolation } from '../middleware/auth.middleware.js';

const router = express.Router();

// Company-scoped notifications (employee + company admin).
router.get('/', authenticate, tenantIsolation, requireCompanyContext, async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, u.email as created_by_email
       FROM notifications n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.company_id = $1::int
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [req.companyId],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Notifications fetch failed', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;

