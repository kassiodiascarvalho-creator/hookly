-- Add 'project_prefund' to the unified_payments payment_type check constraint

-- Drop the existing constraint
ALTER TABLE unified_payments DROP CONSTRAINT IF EXISTS unified_payments_payment_type_check;

-- Add new constraint with project_prefund included
ALTER TABLE unified_payments ADD CONSTRAINT unified_payments_payment_type_check 
CHECK (payment_type = ANY (ARRAY[
  'freelancer_credits'::text, 
  'company_wallet'::text, 
  'contract_funding'::text, 
  'contract_payment'::text, 
  'platform_credits'::text, 
  'company_credits'::text,
  'project_prefund'::text
]));
