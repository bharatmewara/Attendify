-- Company notification recipients (comma-separated)
ALTER TABLE IF EXISTS companies
  ADD COLUMN IF NOT EXISTS notification_emails TEXT;

