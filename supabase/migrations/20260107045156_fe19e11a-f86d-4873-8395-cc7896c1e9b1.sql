-- =============================================
-- INTERNAL CURRENCY SYSTEM: Credits + Earnings
-- =============================================

-- 1. User Balances Table
-- Stores credits (non-withdrawable), earnings (withdrawable), and escrow
CREATE TABLE public.user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('freelancer', 'company')),
  credits_available NUMERIC NOT NULL DEFAULT 0 CHECK (credits_available >= 0),
  earnings_available NUMERIC NOT NULL DEFAULT 0 CHECK (earnings_available >= 0),
  escrow_held NUMERIC NOT NULL DEFAULT 0 CHECK (escrow_held >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_balances_user_id ON public.user_balances(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_balances_updated_at
  BEFORE UPDATE ON public.user_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for user_balances
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance"
  ON public.user_balances FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert balances"
  ON public.user_balances FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update balances"
  ON public.user_balances FOR UPDATE
  USING (true);

-- 2. Ledger Transactions Table (comprehensive audit trail)
CREATE TYPE public.ledger_tx_type AS ENUM (
  'topup_credit',
  'spend_credit',
  'contract_funding',
  'escrow_release',
  'withdrawal_request',
  'withdrawal_paid',
  'refund',
  'adjustment'
);

CREATE TABLE public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tx_type public.ledger_tx_type NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_original NUMERIC,
  currency_original TEXT,
  exchange_rate NUMERIC,
  context TEXT,
  related_contract_id UUID REFERENCES public.contracts(id),
  related_payment_id UUID REFERENCES public.unified_payments(id),
  related_withdrawal_id UUID,
  balance_after_credits NUMERIC,
  balance_after_earnings NUMERIC,
  balance_after_escrow NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ledger_transactions_user_id ON public.ledger_transactions(user_id);
CREATE INDEX idx_ledger_transactions_tx_type ON public.ledger_transactions(tx_type);
CREATE INDEX idx_ledger_transactions_created_at ON public.ledger_transactions(created_at);
CREATE INDEX idx_ledger_transactions_related_payment ON public.ledger_transactions(related_payment_id);

-- RLS for ledger_transactions
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.ledger_transactions FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert transactions"
  ON public.ledger_transactions FOR INSERT
  WITH CHECK (true);

-- 3. Withdrawal Requests Table
CREATE TYPE public.withdrawal_status AS ENUM (
  'pending_review',
  'approved',
  'paid',
  'rejected'
);

CREATE TABLE public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.withdrawal_status NOT NULL DEFAULT 'pending_review',
  payout_method_id UUID REFERENCES public.payout_methods(id),
  payout_details JSONB DEFAULT '{}'::jsonb,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_withdrawal_requests_freelancer ON public.withdrawal_requests(freelancer_user_id);
CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests(status);

-- Trigger for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for withdrawal_requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (freelancer_user_id = auth.uid() OR is_admin());

CREATE POLICY "Freelancers can insert withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (freelancer_user_id = auth.uid());

CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawal_requests FOR UPDATE
  USING (is_admin());

-- Add FK for related_withdrawal_id after table exists
ALTER TABLE public.ledger_transactions
  ADD CONSTRAINT ledger_transactions_withdrawal_fk
  FOREIGN KEY (related_withdrawal_id) REFERENCES public.withdrawal_requests(id);

-- =============================================
-- DATABASE FUNCTIONS
-- =============================================

-- Ensure user balance exists
CREATE OR REPLACE FUNCTION public.ensure_user_balance(p_user_id UUID, p_user_type TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_id UUID;
BEGIN
  SELECT id INTO v_balance_id FROM user_balances WHERE user_id = p_user_id;
  
  IF v_balance_id IS NULL THEN
    INSERT INTO user_balances (user_id, user_type)
    VALUES (p_user_id, p_user_type)
    RETURNING id INTO v_balance_id;
  END IF;
  
  RETURN v_balance_id;
END;
$$;

-- Add credits (from top-up) - NOT withdrawable
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_user_type TEXT,
  p_amount NUMERIC,
  p_payment_id UUID,
  p_amount_original NUMERIC DEFAULT NULL,
  p_currency_original TEXT DEFAULT NULL,
  p_context TEXT DEFAULT 'wallet_topup'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_credits NUMERIC;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM ledger_transactions WHERE related_payment_id = p_payment_id AND tx_type = 'topup_credit') THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure balance exists
  PERFORM ensure_user_balance(p_user_id, p_user_type);
  
  -- Update credits
  UPDATE user_balances 
  SET credits_available = credits_available + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING credits_available INTO v_new_credits;
  
  -- Record transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    amount_original, currency_original,
    context, related_payment_id,
    balance_after_credits
  )
  VALUES (
    p_user_id, 'topup_credit', p_amount, 'USD',
    p_amount_original, p_currency_original,
    p_context, p_payment_id,
    v_new_credits
  );
  
  RETURN TRUE;
END;
$$;

-- Spend credits (proposals, premium features)
CREATE OR REPLACE FUNCTION public.spend_credits(
  p_user_id UUID,
  p_amount NUMERIC,
  p_context TEXT DEFAULT 'proposal_sent'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credits NUMERIC;
  v_new_credits NUMERIC;
BEGIN
  -- Get current credits
  SELECT credits_available INTO v_current_credits 
  FROM user_balances 
  WHERE user_id = p_user_id;
  
  IF v_current_credits IS NULL OR v_current_credits < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE user_balances 
  SET credits_available = credits_available - p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING credits_available INTO v_new_credits;
  
  -- Record transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, balance_after_credits
  )
  VALUES (
    p_user_id, 'spend_credit', -p_amount, 'USD',
    p_context, v_new_credits
  );
  
  RETURN TRUE;
END;
$$;

-- Fund contract (company → escrow)
CREATE OR REPLACE FUNCTION public.fund_contract_escrow(
  p_company_user_id UUID,
  p_contract_id UUID,
  p_amount NUMERIC,
  p_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_escrow NUMERIC;
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM ledger_transactions WHERE related_payment_id = p_payment_id AND tx_type = 'contract_funding') THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure balance exists
  PERFORM ensure_user_balance(p_company_user_id, 'company');
  
  -- Update escrow held
  UPDATE user_balances 
  SET escrow_held = escrow_held + p_amount,
      updated_at = now()
  WHERE user_id = p_company_user_id
  RETURNING escrow_held INTO v_new_escrow;
  
  -- Record transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, related_contract_id, related_payment_id,
    balance_after_escrow
  )
  VALUES (
    p_company_user_id, 'contract_funding', p_amount, 'USD',
    'contract_funding', p_contract_id, p_payment_id,
    v_new_escrow
  );
  
  RETURN TRUE;
END;
$$;

-- Release escrow (company → freelancer earnings)
CREATE OR REPLACE FUNCTION public.release_escrow_to_earnings(
  p_company_user_id UUID,
  p_freelancer_user_id UUID,
  p_contract_id UUID,
  p_amount NUMERIC,
  p_context TEXT DEFAULT 'milestone_approved'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_escrow NUMERIC;
  v_freelancer_earnings NUMERIC;
BEGIN
  -- Ensure freelancer balance exists
  PERFORM ensure_user_balance(p_freelancer_user_id, 'freelancer');
  
  -- Deduct from company escrow
  UPDATE user_balances 
  SET escrow_held = escrow_held - p_amount,
      updated_at = now()
  WHERE user_id = p_company_user_id
  RETURNING escrow_held INTO v_company_escrow;
  
  -- Add to freelancer earnings
  UPDATE user_balances 
  SET earnings_available = earnings_available + p_amount,
      updated_at = now()
  WHERE user_id = p_freelancer_user_id
  RETURNING earnings_available INTO v_freelancer_earnings;
  
  -- Record company transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, related_contract_id,
    balance_after_escrow
  )
  VALUES (
    p_company_user_id, 'escrow_release', -p_amount, 'USD',
    p_context, p_contract_id,
    v_company_escrow
  );
  
  -- Record freelancer transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, related_contract_id,
    balance_after_earnings
  )
  VALUES (
    p_freelancer_user_id, 'escrow_release', p_amount, 'USD',
    p_context, p_contract_id,
    v_freelancer_earnings
  );
  
  RETURN TRUE;
END;
$$;

-- Request withdrawal (freelancer)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_freelancer_user_id UUID,
  p_amount NUMERIC,
  p_payout_method_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_earnings NUMERIC;
  v_new_earnings NUMERIC;
  v_withdrawal_id UUID;
  v_payout_details JSONB;
BEGIN
  -- Get current earnings
  SELECT earnings_available INTO v_current_earnings 
  FROM user_balances 
  WHERE user_id = p_freelancer_user_id;
  
  IF v_current_earnings IS NULL OR v_current_earnings < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;
  
  -- Get payout method details
  SELECT jsonb_build_object(
    'type', type,
    'pix_key', pix_key,
    'pix_key_type', pix_key_type,
    'bank_name', bank_name,
    'branch', branch,
    'account', account,
    'holder_name', holder_name
  ) INTO v_payout_details
  FROM payout_methods
  WHERE id = p_payout_method_id AND freelancer_user_id = p_freelancer_user_id;
  
  IF v_payout_details IS NULL THEN
    RAISE EXCEPTION 'Invalid payout method';
  END IF;
  
  -- Hold earnings (subtract from available)
  UPDATE user_balances 
  SET earnings_available = earnings_available - p_amount,
      updated_at = now()
  WHERE user_id = p_freelancer_user_id
  RETURNING earnings_available INTO v_new_earnings;
  
  -- Create withdrawal request
  INSERT INTO withdrawal_requests (
    freelancer_user_id, amount, currency,
    payout_method_id, payout_details, status
  )
  VALUES (
    p_freelancer_user_id, p_amount, 'USD',
    p_payout_method_id, v_payout_details, 'pending_review'
  )
  RETURNING id INTO v_withdrawal_id;
  
  -- Record transaction
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, related_withdrawal_id,
    balance_after_earnings
  )
  VALUES (
    p_freelancer_user_id, 'withdrawal_request', -p_amount, 'USD',
    'withdrawal_requested', v_withdrawal_id,
    v_new_earnings
  );
  
  RETURN v_withdrawal_id;
END;
$$;

-- Process withdrawal (admin)
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id UUID,
  p_new_status public.withdrawal_status,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal RECORD;
  v_new_earnings NUMERIC;
BEGIN
  -- Get withdrawal
  SELECT * INTO v_withdrawal 
  FROM withdrawal_requests 
  WHERE id = p_withdrawal_id;
  
  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdrawal_requests
  SET status = p_new_status,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      updated_at = now()
  WHERE id = p_withdrawal_id;
  
  -- If rejected, return funds to earnings
  IF p_new_status = 'rejected' THEN
    UPDATE user_balances 
    SET earnings_available = earnings_available + v_withdrawal.amount,
        updated_at = now()
    WHERE user_id = v_withdrawal.freelancer_user_id
    RETURNING earnings_available INTO v_new_earnings;
    
    -- Record refund transaction
    INSERT INTO ledger_transactions (
      user_id, tx_type, amount, currency,
      context, related_withdrawal_id,
      balance_after_earnings
    )
    VALUES (
      v_withdrawal.freelancer_user_id, 'refund', v_withdrawal.amount, 'USD',
      'withdrawal_rejected', p_withdrawal_id,
      v_new_earnings
    );
  END IF;
  
  -- If paid, record final transaction
  IF p_new_status = 'paid' THEN
    INSERT INTO ledger_transactions (
      user_id, tx_type, amount, currency,
      context, related_withdrawal_id,
      metadata
    )
    VALUES (
      v_withdrawal.freelancer_user_id, 'withdrawal_paid', -v_withdrawal.amount, 'USD',
      'withdrawal_completed', p_withdrawal_id,
      jsonb_build_object('admin_id', p_admin_id)
    );
  END IF;
  
  RETURN TRUE;
END;
$$;