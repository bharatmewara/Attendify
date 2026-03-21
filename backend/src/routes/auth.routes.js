import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/audit.js';
import { getClientIp } from '../utils/network.js';
import { isCompanyIpAllowedByPolicy } from '../middleware/networkPolicy.js';

const router = express.Router();

const signToken = (payload) =>
  jwt.sign(payload, config.jwtSecret, {
    expiresIn: '12h',
  });

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const userResult = await query(
      `SELECT u.*, COALESCE(e.company_id, u.company_id) AS company_id, e.first_name, e.last_name, e.employee_code
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       WHERE u.email = $1 AND u.is_active = true
       LIMIT 1`,
      [email.toLowerCase()]
    );

    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.role === 'employee' && user.company_id) {
      const ip = getClientIp(req);
      const allowed = await isCompanyIpAllowedByPolicy(user.company_id, ip, 'employee_login_allowed');
      if (!allowed) {
        return res.status(403).json({
          message: 'Login blocked for this network. Contact your company admin.',
          ip,
        });
      }
    }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    await logAudit({
      companyId: user.company_id,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    const token = signToken({ userId: user.id });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_code: user.employee_code,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*, COALESCE(e.company_id, u.company_id) AS company_id, e.first_name, e.last_name, e.employee_code, c.company_name
       FROM users u
       LEFT JOIN employees e ON u.id = e.user_id
       LEFT JOIN companies c ON COALESCE(e.company_id, u.company_id) = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
        company_name: user.company_name,
        first_name: user.first_name,
        last_name: user.last_name,
        employee_code: user.employee_code,
        impersonateBy: req.user.impersonateBy || null,
        originalRole: req.user.originalRole || null,
        originalUserId: req.user.originalUserId || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/impersonate-exit', authenticate, async (req, res) => {
  if (!req.auth?.impersonateBy) {
    return res.status(400).json({ message: 'No impersonation session found' });
  }

  try {
    const token = signToken({ userId: req.auth.impersonateBy });
    return res.json({ token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userResult = await query('SELECT id FROM users WHERE email = $1 AND is_active = true LIMIT 1', [
      email.toLowerCase(),
    ]);
    const user = userResult.rows[0];
    let devResetToken = null;

    if (user) {
      await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      const rawToken = crypto.randomBytes(32).toString('hex');
      devResetToken = rawToken;
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [user.id, tokenHash],
      );
    }

    return res.json({
      message: 'If this email is registered, a reset link has been generated.',
      ...(process.env.NODE_ENV !== 'production' && devResetToken ? { dev_reset_token: devResetToken } : {}),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ message: 'token and new_password are required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenResult = await query(
      `SELECT user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    const reset = tokenResult.rows[0];
    if (!reset) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newPasswordHash,
      reset.user_id,
    ]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1', [tokenHash]);

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/login-activity', authenticate, async (req, res) => {
  try {
    const companyId = req.user.company_id || null;
    const result = await query(
      `SELECT id, user_id, action, ip_address, user_agent, created_at
       FROM audit_logs
       WHERE action = 'LOGIN'
         AND ($1::int IS NULL OR company_id = $1)
       ORDER BY created_at DESC
       LIMIT 100`,
      [companyId],
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;

  try {
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newPasswordHash,
      req.user.id,
    ]);

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
