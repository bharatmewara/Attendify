-- Add system_settings table for platform-wide config (e.g. product_name)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add username column to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
