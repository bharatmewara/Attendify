-- Run this if incentive_submissions is missing columns
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS gst_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS price_gross NUMERIC(10,2);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_mobile_1 VARCHAR(20);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_mobile_2 VARCHAR(20);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_username VARCHAR(255);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_panel_username VARCHAR(255);
ALTER TABLE IF EXISTS incentive_submissions ADD COLUMN IF NOT EXISTS client_panel_password VARCHAR(255);
