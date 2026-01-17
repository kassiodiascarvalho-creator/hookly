-- Drop existing constraint and add new one with all payment types
ALTER TABLE public.unified_payments 
DROP CONSTRAINT IF EXISTS unified_payments_payment_type_check;

ALTER TABLE public.unified_payments 
ADD CONSTRAINT unified_payments_payment_type_check 
CHECK (payment_type = ANY (ARRAY[
  'freelancer_credits'::text, 
  'company_wallet'::text, 
  'contract_funding'::text, 
  'contract_payment'::text,
  'platform_credits'::text,
  'company_credits'::text
]));