-- Fix for leave_types missing updated_at
ALTER TABLE IF EXISTS leave_types
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
