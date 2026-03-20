-- Fix PostgreSQL ON CONFLICT error for company_subscriptions
-- Adds missing UNIQUE constraint on company_id required by superadmin.routes.js UPSERT

-- Check if constraint already exists
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'company_subscriptions' AND constraint_type = 'UNIQUE';

-- If no result above, run:
ALTER TABLE company_subscriptions 
ADD CONSTRAINT unique_company_subscription 
UNIQUE (company_id);

-- Verify
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'company_subscriptions' AND constraint_type = 'UNIQUE';

