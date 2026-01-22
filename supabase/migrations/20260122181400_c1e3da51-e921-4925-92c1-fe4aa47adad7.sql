
-- Add monthly_credits column to plan definitions
ALTER TABLE freelancer_plan_definitions 
ADD COLUMN IF NOT EXISTS monthly_credits INTEGER NOT NULL DEFAULT 0;

ALTER TABLE company_plan_definitions 
ADD COLUMN IF NOT EXISTS monthly_credits INTEGER NOT NULL DEFAULT 0;

-- Set monthly credits for each plan
UPDATE freelancer_plan_definitions SET monthly_credits = 0 WHERE plan_type = 'free';
UPDATE freelancer_plan_definitions SET monthly_credits = 150 WHERE plan_type = 'starter';
UPDATE freelancer_plan_definitions SET monthly_credits = 200 WHERE plan_type = 'pro';
UPDATE freelancer_plan_definitions SET monthly_credits = 500 WHERE plan_type = 'elite';

UPDATE company_plan_definitions SET monthly_credits = 0 WHERE plan_type = 'free';
UPDATE company_plan_definitions SET monthly_credits = 100 WHERE plan_type = 'starter';
UPDATE company_plan_definitions SET monthly_credits = 300 WHERE plan_type = 'pro';
UPDATE company_plan_definitions SET monthly_credits = 700 WHERE plan_type = 'elite';

-- Add credit cap column (3x monthly)
ALTER TABLE freelancer_plan_definitions 
ADD COLUMN IF NOT EXISTS credit_cap INTEGER DEFAULT NULL;

ALTER TABLE company_plan_definitions 
ADD COLUMN IF NOT EXISTS credit_cap INTEGER DEFAULT NULL;

UPDATE freelancer_plan_definitions SET credit_cap = NULL WHERE plan_type = 'free';
UPDATE freelancer_plan_definitions SET credit_cap = 450 WHERE plan_type = 'starter';
UPDATE freelancer_plan_definitions SET credit_cap = 600 WHERE plan_type = 'pro';
UPDATE freelancer_plan_definitions SET credit_cap = 1500 WHERE plan_type = 'elite';

UPDATE company_plan_definitions SET credit_cap = NULL WHERE plan_type = 'free';
UPDATE company_plan_definitions SET credit_cap = 300 WHERE plan_type = 'starter';
UPDATE company_plan_definitions SET credit_cap = 900 WHERE plan_type = 'pro';
UPDATE company_plan_definitions SET credit_cap = 2100 WHERE plan_type = 'elite';

-- Create plan_credit_grants table for idempotency
CREATE TABLE IF NOT EXISTS plan_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('freelancer', 'company')),
  plan_type TEXT NOT NULL,
  subscription_id TEXT, -- Stripe subscription ID
  grant_type TEXT NOT NULL CHECK (grant_type IN ('initial', 'monthly')),
  grant_period_start DATE NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, subscription_id, grant_period_start, grant_type)
);

-- Enable RLS
ALTER TABLE plan_credit_grants ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own grants" ON plan_credit_grants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all grants" ON plan_credit_grants
  FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert grants" ON plan_credit_grants
  FOR INSERT WITH CHECK (true);

-- Add last_plan_credit_grant_at to tracking
ALTER TABLE freelancer_plans 
ADD COLUMN IF NOT EXISTS last_credit_grant_at TIMESTAMPTZ;

ALTER TABLE company_plans 
ADD COLUMN IF NOT EXISTS last_credit_grant_at TIMESTAMPTZ;

-- Function to grant plan credits (initial or monthly)
CREATE OR REPLACE FUNCTION public.grant_plan_credits(
  p_user_id UUID,
  p_user_type TEXT,
  p_plan_type TEXT,
  p_subscription_id TEXT,
  p_grant_type TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monthly_credits INTEGER;
  v_credit_cap INTEGER;
  v_current_balance INTEGER;
  v_grant_amount INTEGER;
  v_new_balance INTEGER;
  v_grant_period DATE;
  v_existing_grant UUID;
BEGIN
  -- Determine grant period (first of month for monthly, today for initial)
  IF p_grant_type = 'initial' THEN
    v_grant_period := CURRENT_DATE;
  ELSE
    v_grant_period := date_trunc('month', CURRENT_DATE)::DATE;
  END IF;

  -- Check idempotency - already granted for this period?
  SELECT id INTO v_existing_grant
  FROM plan_credit_grants
  WHERE user_id = p_user_id
    AND subscription_id = p_subscription_id
    AND grant_period_start = v_grant_period
    AND grant_type = p_grant_type;

  IF v_existing_grant IS NOT NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'ALREADY_GRANTED',
      'grant_id', v_existing_grant
    );
  END IF;

  -- Get plan credits and cap
  IF p_user_type = 'freelancer' THEN
    SELECT monthly_credits, credit_cap INTO v_monthly_credits, v_credit_cap
    FROM freelancer_plan_definitions
    WHERE plan_type = p_plan_type AND is_active = true;
  ELSE
    SELECT monthly_credits, credit_cap INTO v_monthly_credits, v_credit_cap
    FROM company_plan_definitions
    WHERE plan_type = p_plan_type AND is_active = true;
  END IF;

  IF v_monthly_credits IS NULL OR v_monthly_credits = 0 THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'NO_CREDITS_FOR_PLAN',
      'plan_type', p_plan_type
    );
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM platform_credits
  WHERE user_id = p_user_id;

  v_current_balance := COALESCE(v_current_balance, 0);

  -- Calculate grant amount respecting cap
  v_grant_amount := v_monthly_credits;
  IF v_credit_cap IS NOT NULL THEN
    IF v_current_balance >= v_credit_cap THEN
      RETURN jsonb_build_object(
        'granted', false,
        'reason', 'AT_CAP',
        'current_balance', v_current_balance,
        'cap', v_credit_cap
      );
    END IF;
    -- Only grant up to cap
    IF (v_current_balance + v_monthly_credits) > v_credit_cap THEN
      v_grant_amount := v_credit_cap - v_current_balance;
    END IF;
  END IF;

  -- Insert or update platform_credits
  INSERT INTO platform_credits (user_id, user_type, balance)
  VALUES (p_user_id, p_user_type, v_grant_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = platform_credits.balance + v_grant_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO platform_credit_transactions (
    user_id, user_type, action, amount, balance_after, description
  ) VALUES (
    p_user_id,
    p_user_type,
    CASE WHEN p_grant_type = 'initial' THEN 'plan_grant_initial' ELSE 'plan_grant_monthly' END,
    v_grant_amount,
    v_new_balance,
    CASE WHEN p_grant_type = 'initial' 
      THEN 'Créditos iniciais do plano ' || p_plan_type || ' (' || v_grant_amount || ' créditos)'
      ELSE 'Renovação mensal do plano ' || p_plan_type || ' (' || v_grant_amount || ' créditos)'
    END
  );

  -- Record grant for idempotency
  INSERT INTO plan_credit_grants (
    user_id, user_type, plan_type, subscription_id, grant_type, grant_period_start, amount
  ) VALUES (
    p_user_id, p_user_type, p_plan_type, p_subscription_id, p_grant_type, v_grant_period, v_grant_amount
  );

  -- Update last grant timestamp
  IF p_user_type = 'freelancer' THEN
    UPDATE freelancer_plans SET last_credit_grant_at = now() WHERE freelancer_user_id = p_user_id;
  ELSE
    UPDATE company_plans SET last_credit_grant_at = now() WHERE company_user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'granted', true,
    'amount', v_grant_amount,
    'new_balance', v_new_balance,
    'grant_type', p_grant_type,
    'plan_type', p_plan_type
  );
END;
$$;

-- Function to check and grant monthly plan credits (lazy renewal)
CREATE OR REPLACE FUNCTION public.check_and_grant_plan_credits(p_user_id UUID, p_user_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_type TEXT;
  v_subscription_id TEXT;
  v_subscription_status TEXT;
  v_last_grant TIMESTAMPTZ;
  v_days_since_grant INTEGER;
  v_grant_result JSONB;
BEGIN
  -- Get subscription info
  IF p_user_type = 'freelancer' THEN
    SELECT plan_type, stripe_subscription_id, status, last_credit_grant_at
    INTO v_plan_type, v_subscription_id, v_subscription_status, v_last_grant
    FROM freelancer_plans
    WHERE freelancer_user_id = p_user_id;
  ELSE
    SELECT plan_type, stripe_subscription_id, status, last_credit_grant_at
    INTO v_plan_type, v_subscription_id, v_subscription_status, v_last_grant
    FROM company_plans
    WHERE company_user_id = p_user_id;
  END IF;

  -- No subscription or free plan
  IF v_plan_type IS NULL OR v_plan_type = 'free' THEN
    -- Fall back to old free plan logic
    RETURN check_and_grant_monthly_credits(p_user_id, p_user_type);
  END IF;

  -- Subscription not active
  IF v_subscription_status != 'active' THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'SUBSCRIPTION_NOT_ACTIVE',
      'status', v_subscription_status
    );
  END IF;

  -- Check 30-day interval
  IF v_last_grant IS NOT NULL THEN
    v_days_since_grant := EXTRACT(DAY FROM (now() - v_last_grant));
    IF v_days_since_grant < 30 THEN
      RETURN jsonb_build_object(
        'granted', false,
        'reason', 'NOT_ENOUGH_TIME',
        'days_remaining', 30 - v_days_since_grant,
        'last_grant', v_last_grant
      );
    END IF;
  END IF;

  -- Grant credits
  v_grant_result := grant_plan_credits(
    p_user_id,
    p_user_type,
    v_plan_type,
    v_subscription_id,
    'monthly'
  );

  RETURN v_grant_result;
END;
$$;
