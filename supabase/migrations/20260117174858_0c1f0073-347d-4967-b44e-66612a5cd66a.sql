-- Create contract_acceptances table for audit trail
CREATE TABLE public.contract_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL,
  accepted_by_role TEXT NOT NULL CHECK (accepted_by_role IN ('company', 'freelancer')),
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  terms_version TEXT NOT NULL DEFAULT '1.0',
  contract_version TEXT NOT NULL DEFAULT '1.0',
  contract_snapshot_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contract_id, accepted_by_role)
);

-- Enable RLS
ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view acceptances for their contracts"
ON public.contract_acceptances
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id
    AND (c.company_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
  )
);

CREATE POLICY "Users can insert their own acceptance"
ON public.contract_acceptances
FOR INSERT
WITH CHECK (
  accepted_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.contracts c
    WHERE c.id = contract_id
    AND (
      (accepted_by_role = 'company' AND c.company_user_id = auth.uid()) OR
      (accepted_by_role = 'freelancer' AND c.freelancer_user_id = auth.uid())
    )
  )
);

-- Add pending_acceptance to contract status if not exists
-- First check existing constraint and update it
DO $$
BEGIN
  -- Drop existing constraint if any
  ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
  
  -- Add new constraint with pending_acceptance
  ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check 
    CHECK (status IN ('draft', 'pending_acceptance', 'active', 'funded', 'completed', 'cancelled'));
EXCEPTION
  WHEN others THEN
    -- If constraint doesn't exist or other error, just add the new one
    NULL;
END $$;

-- Create index for faster lookups
CREATE INDEX idx_contract_acceptances_contract_id ON public.contract_acceptances(contract_id);
CREATE INDEX idx_contract_acceptances_user_id ON public.contract_acceptances(accepted_by_user_id);