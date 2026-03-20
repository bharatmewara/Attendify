-- Fix company_subscriptions status CHECK constraint
-- Adds 'pending_payment' for superadmin assign-subscription

-- Drop old constraint if exists
ALTER TABLE company_subscriptions DROP CONSTRAINT IF EXISTS company_subscriptions_status_check;

-- Add new constraint with pending_payment included
ALTER TABLE company_subscriptions ADD CONSTRAINT company_subscriptions_status_check 
CHECK (status IN ('active', 'pending_payment', 'expired', 'cancelled'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'company_subscriptions'::regclass AND contype = 'c';
