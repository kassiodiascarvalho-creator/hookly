-- Create wallets table for internal "Contracts" credit system
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  balance_contracts numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create wallet_transactions ledger table
CREATE TABLE public.wallet_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('topup', 'debit', 'credit', 'refund')),
  amount_contracts numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  fiat_amount numeric NOT NULL,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Enable RLS on wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallets
CREATE POLICY "Users can view own wallet"
  ON public.wallets
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert wallets"
  ON public.wallets
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update wallets"
  ON public.wallets
  FOR UPDATE
  USING (true);

-- RLS Policies for wallet_transactions
CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert transactions"
  ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update transactions"
  ON public.wallet_transactions
  FOR UPDATE
  USING (true);

-- Create function to initialize wallet for new users
CREATE OR REPLACE FUNCTION public.ensure_user_wallet(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_id uuid;
BEGIN
  SELECT id INTO wallet_id FROM wallets WHERE user_id = p_user_id;
  
  IF wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance_contracts)
    VALUES (p_user_id, 0)
    RETURNING id INTO wallet_id;
  END IF;
  
  RETURN wallet_id;
END;
$$;

-- Create function to credit wallet (called by webhook)
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_session_id text,
  p_currency text DEFAULT 'USD',
  p_fiat_amount numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_tx uuid;
BEGIN
  -- Check for idempotency - prevent duplicate credits
  SELECT id INTO existing_tx 
  FROM wallet_transactions 
  WHERE stripe_checkout_session_id = p_session_id 
    AND status = 'confirmed';
  
  IF existing_tx IS NOT NULL THEN
    RETURN false; -- Already processed
  END IF;
  
  -- Ensure wallet exists
  PERFORM ensure_user_wallet(p_user_id);
  
  -- Insert transaction
  INSERT INTO wallet_transactions (
    user_id, type, amount_contracts, currency, fiat_amount, 
    stripe_checkout_session_id, status, description
  ) VALUES (
    p_user_id, 'topup', p_amount, p_currency, COALESCE(p_fiat_amount, p_amount),
    p_session_id, 'confirmed', 'Funds added via Stripe'
  );
  
  -- Update wallet balance
  UPDATE wallets 
  SET balance_contracts = balance_contracts + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN true;
END;
$$;