-- Migration 0008: Add notes to incentive_submissions
-- Adds a notes column to allow users or admins to leave notes on submissions

ALTER TABLE incentive_submissions ADD COLUMN IF NOT EXISTS notes TEXT;
