-- =====================================================
-- HYBRID PAYMENT SYSTEM DATABASE MIGRATION
-- =====================================================

-- 1. Add country field to company_profiles (ISO 3166-1 alpha-2)
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- 2. Add proposal_credits to freelancer_profiles (for buying proposal credits)
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS proposal_credits INTEGER NOT NULL DEFAULT 0;

-- 3. Create company_wallets table (separate from freelancer wallets)
CREATE TABLE IF NOT EXISTS public.company_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_user_id UUID NOT NULL UNIQUE,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on company_wallets
ALTER TABLE public.company_wallets ENABLE ROW LEVEL SECURITY;

-- Company wallet policies
CREATE POLICY "Users can view own company wallet" 
ON public.company_wallets FOR SELECT 
USING ((company_user_id = auth.uid()) OR is_admin());

CREATE POLICY "System can insert company wallets" 
ON public.company_wallets FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update company wallets" 
ON public.company_wallets FOR UPDATE 
USING (true);

-- 4. Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_user_id UUID NOT NULL,
  freelancer_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'funded', 'completed', 'cancelled')),
  milestones JSONB DEFAULT '[]'::jsonb,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Contract policies
CREATE POLICY "Users can view own contracts" 
ON public.contracts FOR SELECT 
USING ((company_user_id = auth.uid()) OR (freelancer_user_id = auth.uid()) OR is_admin());

CREATE POLICY "System can insert contracts" 
ON public.contracts FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update own contracts" 
ON public.contracts FOR UPDATE 
USING ((company_user_id = auth.uid()) OR (freelancer_user_id = auth.uid()) OR is_admin());

-- 5. Create payment_providers table (for admin config)
CREATE TABLE IF NOT EXISTS public.payment_providers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('stripe', 'mercadopago')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  config_encrypted JSONB DEFAULT '{}'::jsonb,
  webhook_url TEXT,
  last_tested_at TIMESTAMP WITH TIME ZONE,
  test_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_providers
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage payment providers
CREATE POLICY "Admins can view payment providers" 
ON public.payment_providers FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can insert payment providers" 
ON public.payment_providers FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update payment providers" 
ON public.payment_providers FOR UPDATE 
USING (is_admin());

-- 6. Create unified_payments table (for tracking all payment types)
CREATE TABLE IF NOT EXISTS public.unified_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('freelancer_credits', 'company_wallet', 'contract_funding', 'contract_payment')),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'freelancer')),
  contract_id UUID REFERENCES public.contracts(id),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits_amount INTEGER,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
  provider_payment_id TEXT,
  provider_preference_id TEXT,
  provider_checkout_url TEXT,
  provider_checkout_id TEXT,
  external_reference TEXT UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on unified_payments
ALTER TABLE public.unified_payments ENABLE ROW LEVEL SECURITY;

-- Unified payments policies
CREATE POLICY "Users can view own unified payments" 
ON public.unified_payments FOR SELECT 
USING ((user_id = auth.uid()) OR is_admin());

CREATE POLICY "System can insert unified payments" 
ON public.unified_payments FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update unified payments" 
ON public.unified_payments FOR UPDATE 
USING (true);

-- 7. Create ledger_entries table (for financial audit trail)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'freelancer')),
  payment_id UUID REFERENCES public.unified_payments(id),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits_amount INTEGER,
  balance_after_cents BIGINT,
  credits_after INTEGER,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ledger_entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- Ledger entry policies
CREATE POLICY "Users can view own ledger entries" 
ON public.ledger_entries FOR SELECT 
USING ((user_id = auth.uid()) OR is_admin());

CREATE POLICY "System can insert ledger entries" 
ON public.ledger_entries FOR INSERT 
WITH CHECK (true);

-- 8. Insert default payment providers configuration
INSERT INTO public.payment_providers (provider, is_enabled, is_sandbox)
VALUES 
  ('stripe', true, false),
  ('mercadopago', false, true)
ON CONFLICT (provider) DO NOTHING;

-- 9. Create function to ensure company wallet exists
CREATE OR REPLACE FUNCTION public.ensure_company_wallet(p_company_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM company_wallets WHERE company_user_id = p_company_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO company_wallets (company_user_id, balance_cents, currency)
    VALUES (p_company_user_id, 0, 'USD')
    RETURNING id INTO v_wallet_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;

-- 10. Create function to credit company wallet (called by webhooks)
CREATE OR REPLACE FUNCTION public.credit_company_wallet(
  p_company_user_id UUID,
  p_amount_cents BIGINT,
  p_payment_id UUID,
  p_reason TEXT DEFAULT 'wallet_topup'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance BIGINT;
  v_wallet_id UUID;
BEGIN
  -- Ensure wallet exists
  PERFORM ensure_company_wallet(p_company_user_id);
  
  -- Check idempotency
  IF EXISTS (SELECT 1 FROM ledger_entries WHERE payment_id = p_payment_id AND user_type = 'company') THEN
    RETURN FALSE;
  END IF;
  
  -- Update balance
  UPDATE company_wallets 
  SET balance_cents = balance_cents + p_amount_cents,
      updated_at = now()
  WHERE company_user_id = p_company_user_id
  RETURNING balance_cents, id INTO v_new_balance, v_wallet_id;
  
  -- Record ledger entry
  INSERT INTO ledger_entries (
    user_id, user_type, payment_id, direction, 
    amount_cents, currency, balance_after_cents, reason
  )
  VALUES (
    p_company_user_id, 'company', p_payment_id, 'credit',
    p_amount_cents, 'USD', v_new_balance, p_reason
  );
  
  RETURN TRUE;
END;
$$;

-- 11. Create function to add freelancer proposal credits (called by webhooks)
CREATE OR REPLACE FUNCTION public.add_freelancer_credits(
  p_freelancer_user_id UUID,
  p_credits INTEGER,
  p_payment_id UUID,
  p_reason TEXT DEFAULT 'credits_purchase'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_credits INTEGER;
BEGIN
  -- Check idempotency
  IF EXISTS (SELECT 1 FROM ledger_entries WHERE payment_id = p_payment_id AND user_type = 'freelancer') THEN
    RETURN FALSE;
  END IF;
  
  -- Update credits
  UPDATE freelancer_profiles 
  SET proposal_credits = proposal_credits + p_credits,
      updated_at = now()
  WHERE user_id = p_freelancer_user_id
  RETURNING proposal_credits INTO v_new_credits;
  
  IF v_new_credits IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Record ledger entry
  INSERT INTO ledger_entries (
    user_id, user_type, payment_id, direction, 
    amount_cents, currency, credits_amount, credits_after, reason
  )
  VALUES (
    p_freelancer_user_id, 'freelancer', p_payment_id, 'credit',
    0, 'USD', p_credits, v_new_credits, p_reason
  );
  
  RETURN TRUE;
END;
$$;

-- 12. Create function to consume freelancer credit (when sending proposal)
CREATE OR REPLACE FUNCTION public.consume_proposal_credit(p_freelancer_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_credits INTEGER;
BEGIN
  -- Get current credits
  SELECT proposal_credits INTO v_current_credits 
  FROM freelancer_profiles 
  WHERE user_id = p_freelancer_user_id;
  
  IF v_current_credits IS NULL OR v_current_credits < 1 THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credit
  UPDATE freelancer_profiles 
  SET proposal_credits = proposal_credits - 1,
      updated_at = now()
  WHERE user_id = p_freelancer_user_id
  RETURNING proposal_credits INTO v_new_credits;
  
  -- Record ledger entry
  INSERT INTO ledger_entries (
    user_id, user_type, direction, 
    credits_amount, credits_after, reason
  )
  VALUES (
    p_freelancer_user_id, 'freelancer', 'debit',
    1, v_new_credits, 'proposal_sent'
  );
  
  RETURN TRUE;
END;
$$;

-- 13. Create function to auto-create contract when proposal is accepted
CREATE OR REPLACE FUNCTION public.create_contract_from_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_total_amount BIGINT;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get project info
    SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;
    
    -- Calculate total from milestones
    SELECT COALESCE(SUM((m->>'amount')::NUMERIC * 100), 0)::BIGINT INTO v_total_amount
    FROM jsonb_array_elements(NEW.milestones) AS m;
    
    -- Create contract
    INSERT INTO contracts (
      proposal_id, project_id, company_user_id, freelancer_user_id,
      title, description, amount_cents, currency, milestones, status
    )
    VALUES (
      NEW.id, NEW.project_id, v_project.company_user_id, NEW.freelancer_user_id,
      v_project.title, v_project.description, v_total_amount, v_project.currency, NEW.milestones, 'active'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-creating contracts
DROP TRIGGER IF EXISTS trigger_create_contract_on_proposal_accept ON public.proposals;
CREATE TRIGGER trigger_create_contract_on_proposal_accept
AFTER UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.create_contract_from_proposal();

-- 14. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_unified_payments_user_id ON public.unified_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_payments_status ON public.unified_payments(status);
CREATE INDEX IF NOT EXISTS idx_unified_payments_external_reference ON public.unified_payments(external_reference);
CREATE INDEX IF NOT EXISTS idx_unified_payments_provider_payment_id ON public.unified_payments(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id ON public.ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payment_id ON public.ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_contracts_company_user_id ON public.contracts(company_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_freelancer_user_id ON public.contracts(freelancer_user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_company_profiles_country ON public.company_profiles(country);