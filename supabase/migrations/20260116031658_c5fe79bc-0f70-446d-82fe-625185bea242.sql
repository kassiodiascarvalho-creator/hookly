-- FASE 1: Sistema de Créditos da Plataforma (Separado de Escrow/Freelancer)
-- Créditos são EXCLUSIVAMENTE para funcionalidades internas da plataforma

-- Tabela de saldo de créditos da plataforma
CREATE TABLE IF NOT EXISTS public.platform_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'freelancer')),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de transações de créditos da plataforma
CREATE TABLE IF NOT EXISTS public.platform_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'freelancer')),
  amount INTEGER NOT NULL, -- Positivo = adição, Negativo = consumo
  balance_after INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'topup', 'spend_proposal', 'spend_view_company', 'spend_highlight', 'spend_boost'
  description TEXT,
  payment_id UUID REFERENCES public.unified_payments(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de configuração de custos por ação (Admin configurável)
CREATE TABLE IF NOT EXISTS public.platform_action_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_key TEXT NOT NULL UNIQUE, -- 'send_proposal', 'view_company_data', 'highlight_proposal', 'boost_profile'
  cost_credits INTEGER NOT NULL DEFAULT 1 CHECK (cost_credits >= 0),
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_action_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_credits
CREATE POLICY "Users can view their own credits"
ON public.platform_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert credits"
ON public.platform_credits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update credits"
ON public.platform_credits FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for platform_credit_transactions
CREATE POLICY "Users can view their own transactions"
ON public.platform_credit_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions"
ON public.platform_credit_transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for platform_action_costs (read by all, write by admin)
CREATE POLICY "Anyone can view action costs"
ON public.platform_action_costs FOR SELECT
USING (true);

CREATE POLICY "Admins can manage action costs"
ON public.platform_action_costs FOR ALL
USING (public.is_admin());

-- Indexes
CREATE INDEX idx_platform_credits_user ON public.platform_credits(user_id);
CREATE INDEX idx_platform_credit_transactions_user ON public.platform_credit_transactions(user_id);
CREATE INDEX idx_platform_credit_transactions_created ON public.platform_credit_transactions(created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_platform_credits_updated_at
BEFORE UPDATE ON public.platform_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_action_costs_updated_at
BEFORE UPDATE ON public.platform_action_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default action costs
INSERT INTO public.platform_action_costs (action_key, cost_credits, display_name, description)
VALUES 
  ('send_proposal', 1, 'Enviar Proposta', 'Custo para enviar uma proposta a um projeto'),
  ('view_company_data', 1, 'Ver Dados Completos', 'Custo para ver dados completos da empresa'),
  ('highlight_proposal', 2, 'Destacar Proposta', 'Custo para destacar sua proposta no topo'),
  ('boost_profile', 5, 'Impulsionar Perfil', 'Custo para impulsionar seu perfil por 7 dias')
ON CONFLICT (action_key) DO NOTHING;

-- Function to add platform credits (for topups)
CREATE OR REPLACE FUNCTION public.add_platform_credits(
  p_user_id UUID,
  p_user_type TEXT,
  p_amount INTEGER,
  p_payment_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Recarga de créditos'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Idempotency check
  IF p_payment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM platform_credit_transactions 
    WHERE payment_id = p_payment_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Upsert credits balance
  INSERT INTO platform_credits (user_id, user_type, balance)
  VALUES (p_user_id, p_user_type, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = platform_credits.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO platform_credit_transactions (
    user_id, user_type, amount, balance_after, action, description, payment_id
  )
  VALUES (
    p_user_id, p_user_type, p_amount, v_new_balance, 'topup', p_description, p_payment_id
  );

  RETURN TRUE;
END;
$$;

-- Function to spend platform credits (for actions)
CREATE OR REPLACE FUNCTION public.spend_platform_credits(
  p_user_id UUID,
  p_action_key TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost INTEGER;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_user_type TEXT;
  v_action_enabled BOOLEAN;
BEGIN
  -- Get action cost and check if enabled
  SELECT cost_credits, is_enabled INTO v_cost, v_action_enabled
  FROM platform_action_costs
  WHERE action_key = p_action_key;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action: %', p_action_key;
  END IF;

  IF NOT v_action_enabled THEN
    -- Action is disabled, allow for free
    RETURN TRUE;
  END IF;

  IF v_cost = 0 THEN
    -- Free action
    RETURN TRUE;
  END IF;

  -- Get current balance and user type
  SELECT balance, user_type INTO v_current_balance, v_user_type
  FROM platform_credits
  WHERE user_id = p_user_id;

  IF v_current_balance IS NULL OR v_current_balance < v_cost THEN
    RETURN FALSE; -- Insufficient credits
  END IF;

  -- Deduct credits
  UPDATE platform_credits
  SET balance = balance - v_cost,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO platform_credit_transactions (
    user_id, user_type, amount, balance_after, action, description
  )
  VALUES (
    p_user_id, v_user_type, -v_cost, v_new_balance, 
    'spend_' || p_action_key, 
    COALESCE(p_description, 'Consumo: ' || p_action_key)
  );

  RETURN TRUE;
END;
$$;

-- Function to check if user has enough credits for an action
CREATE OR REPLACE FUNCTION public.check_platform_credits(
  p_user_id UUID,
  p_action_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost INTEGER;
  v_balance INTEGER;
  v_action_enabled BOOLEAN;
BEGIN
  -- Get action cost
  SELECT cost_credits, is_enabled INTO v_cost, v_action_enabled
  FROM platform_action_costs
  WHERE action_key = p_action_key;

  IF v_cost IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If action is disabled, it's free
  IF NOT v_action_enabled OR v_cost = 0 THEN
    RETURN TRUE;
  END IF;

  -- Check balance
  SELECT balance INTO v_balance
  FROM platform_credits
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balance, 0) >= v_cost;
END;
$$;