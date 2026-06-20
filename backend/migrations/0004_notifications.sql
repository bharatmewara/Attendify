-- Migration 0004: Notifications table
-- Push notification system for company employees

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  type       VARCHAR(50) DEFAULT 'info'   CHECK (type     IN ('info','success','warning','error')),
  priority   VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  is_read    BOOLEAN DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add user_id if not already present (for user-specific notifications)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_company    ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Subscription payments: due_date column
ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS due_date DATE;
