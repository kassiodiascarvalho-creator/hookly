-- Add columns for double acceptance flow
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS company_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS freelancer_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contract_terms_version TEXT DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS deadline DATE DEFAULT NULL;

-- Add index for faster queries on acceptance status
CREATE INDEX IF NOT EXISTS idx_contracts_acceptance ON public.contracts(company_accepted_at, freelancer_accepted_at);

-- Update status enum description (contracts can be: draft, pending_acceptance, active, funded, completed, cancelled)
COMMENT ON COLUMN public.contracts.status IS 'Contract status: draft (initial), pending_acceptance (awaiting double accept), active (both accepted), funded (escrow loaded), completed, cancelled';