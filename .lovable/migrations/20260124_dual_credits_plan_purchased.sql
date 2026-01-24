-- ============================================
-- MIGRATION: Dual Credits System (Plan + Purchased)
-- ============================================

-- 1) Add new columns for plan and purchased balances
ALTER TABLE platform_credits
ADD COLUMN IF NOT EXISTS plan_balance integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchased_balance integer NOT NULL DEFAULT 0;

-- 2) Backfill: existing balance becomes purchased_balance
UPDATE platform_credits
SET purchased_balance = balance,
    plan_balance = 0
WHERE purchased_balance = 0 AND balance > 0;

-- 3) Create trigger to keep balance synced with plan_balance + purchased_balance
CREATE OR REPLACE FUNCTION sync_platform_credits_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance := NEW.plan_balance + NEW.purchased_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_balance_trigger ON platform_credits;
CREATE TRIGGER sync_balance_trigger
BEFORE INSERT OR UPDATE ON platform_credits
FOR EACH ROW EXECUTE FUNCTION sync_platform_credits_balance();

-- 4) Update spend_platform_credits to consume plan_balance first, then purchased_balance
CREATE OR REPLACE FUNCTION public.spend_platform_credits(
  p_user_id uuid,
  p_action_key text,
  p_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost INTEGER;
  v_plan_balance INTEGER;
  v_purchased_balance INTEGER;
  v_total_balance INTEGER;
  v_new_plan INTEGER;
  v_new_purchased INTEGER;
  v_new_total INTEGER;
  v_user_type TEXT;
  v_action_enabled BOOLEAN;
  v_from_plan INTEGER;
  v_from_purchased INTEGER;
BEGIN
  -- Get action cost and check if enabled
  SELECT cost_credits, is_enabled INTO v_cost, v_action_enabled
  FROM platform_action_costs
  WHERE action_key = p_action_key;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action: %', p_action_key;
  END IF;

  IF NOT v_action_enabled THEN
    RETURN TRUE;
  END IF;

  IF v_cost = 0 THEN
    RETURN TRUE;
  END IF;

  SELECT plan_balance, purchased_balance, balance, user_type 
  INTO v_plan_balance, v_purchased_balance, v_total_balance, v_user_type
  FROM platform_credits
  WHERE user_id = p_user_id;

  v_plan_balance := COALESCE(v_plan_balance, 0);
  v_purchased_balance := COALESCE(v_purchased_balance, 0);
  v_total_balance := COALESCE(v_total_balance, 0);

  IF v_total_balance < v_cost THEN
    RETURN FALSE;
  END IF;

  -- Priority: plan_balance first, then purchased_balance
  IF v_plan_balance >= v_cost THEN
    v_from_plan := v_cost;
    v_from_purchased := 0;
  ELSE
    v_from_plan := v_plan_balance;
    v_from_purchased := v_cost - v_plan_balance;
  END IF;

  v_new_plan := v_plan_balance - v_from_plan;
  v_new_purchased := v_purchased_balance - v_from_purchased;
  v_new_total := v_new_plan + v_new_purchased;

  UPDATE platform_credits
  SET plan_balance = v_new_plan,
      purchased_balance = v_new_purchased,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO platform_credit_transactions (
    user_id, user_type, amount, balance_after, action, description
  )
  VALUES (
    p_user_id, v_user_type, -v_cost, v_new_total, 
    'spend_' || p_action_key, 
    COALESCE(p_description, 'Consumo: ' || p_action_key) || 
    ' (plano: -' || v_from_plan || ', avulso: -' || v_from_purchased || ')'
  );

  RETURN TRUE;
END;
$$;

-- 5) Update add_platform_credits with credit_type parameter
CREATE OR REPLACE FUNCTION public.add_platform_credits(
  p_user_id uuid,
  p_user_type text,
  p_amount integer,
  p_payment_id uuid DEFAULT NULL,
  p_description text DEFAULT 'Recarga de créditos',
  p_credit_type text DEFAULT 'purchased'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  IF p_payment_id IS NOT NULL THEN
    BEGIN
      INSERT INTO platform_credit_transactions (
        user_id, user_type, amount, balance_after, action, description, payment_id
      ) VALUES (
        p_user_id, p_user_type, p_amount, 0, 'topup', p_description, p_payment_id
      );
    EXCEPTION WHEN unique_violation THEN
      RETURN FALSE;
    END;
    
    IF p_credit_type = 'plan' THEN
      INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
      VALUES (p_user_id, p_user_type, p_amount, 0)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        plan_balance = platform_credits.plan_balance + p_amount,
        updated_at = now()
      RETURNING plan_balance + purchased_balance INTO v_new_balance;
    ELSE
      INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
      VALUES (p_user_id, p_user_type, 0, p_amount)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        purchased_balance = platform_credits.purchased_balance + p_amount,
        updated_at = now()
      RETURNING plan_balance + purchased_balance INTO v_new_balance;
    END IF;
    
    UPDATE platform_credit_transactions 
    SET balance_after = v_new_balance 
    WHERE payment_id = p_payment_id;
    
    RETURN TRUE;
  END IF;

  IF p_credit_type = 'plan' THEN
    INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
    VALUES (p_user_id, p_user_type, p_amount, 0)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      plan_balance = platform_credits.plan_balance + p_amount,
      updated_at = now()
    RETURNING plan_balance + purchased_balance INTO v_new_balance;
  ELSE
    INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
    VALUES (p_user_id, p_user_type, 0, p_amount)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      purchased_balance = platform_credits.purchased_balance + p_amount,
      updated_at = now()
    RETURNING plan_balance + purchased_balance INTO v_new_balance;
  END IF;

  INSERT INTO platform_credit_transactions (
    user_id, user_type, amount, balance_after, action, description, payment_id
  ) VALUES (
    p_user_id, p_user_type, p_amount, v_new_balance, 'topup', p_description, NULL
  );

  RETURN TRUE;
END;
$$;

-- 6) Update grant_plan_credits to credit plan_balance specifically
CREATE OR REPLACE FUNCTION public.grant_plan_credits(
  p_user_id uuid,
  p_user_type text,
  p_plan_type text,
  p_subscription_id text,
  p_grant_type text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_monthly_credits INTEGER;
  v_credit_cap INTEGER;
  v_current_plan_balance INTEGER;
  v_grant_amount INTEGER;
  v_new_plan_balance INTEGER;
  v_new_total INTEGER;
  v_grant_period DATE;
  v_existing_grant UUID;
BEGIN
  IF p_grant_type = 'initial' THEN
    v_grant_period := CURRENT_DATE;
  ELSE
    v_grant_period := date_trunc('month', CURRENT_DATE)::DATE;
  END IF;

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

  SELECT plan_balance INTO v_current_plan_balance
  FROM platform_credits
  WHERE user_id = p_user_id;

  v_current_plan_balance := COALESCE(v_current_plan_balance, 0);

  v_grant_amount := v_monthly_credits;
  IF v_credit_cap IS NOT NULL THEN
    IF v_current_plan_balance >= v_credit_cap THEN
      RETURN jsonb_build_object(
        'granted', false,
        'reason', 'AT_CAP',
        'current_plan_balance', v_current_plan_balance,
        'cap', v_credit_cap
      );
    END IF;
    IF (v_current_plan_balance + v_monthly_credits) > v_credit_cap THEN
      v_grant_amount := v_credit_cap - v_current_plan_balance;
    END IF;
  END IF;

  INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
  VALUES (p_user_id, p_user_type, v_grant_amount, 0)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    plan_balance = platform_credits.plan_balance + v_grant_amount,
    updated_at = now()
  RETURNING plan_balance, plan_balance + purchased_balance INTO v_new_plan_balance, v_new_total;

  INSERT INTO platform_credit_transactions (
    user_id, user_type, action, amount, balance_after, description
  ) VALUES (
    p_user_id,
    p_user_type,
    CASE WHEN p_grant_type = 'initial' THEN 'plan_grant_initial' ELSE 'plan_grant_monthly' END,
    v_grant_amount,
    v_new_total,
    CASE WHEN p_grant_type = 'initial' 
      THEN 'Créditos iniciais do plano ' || p_plan_type || ' (' || v_grant_amount || ' créditos)'
      ELSE 'Renovação mensal do plano ' || p_plan_type || ' (' || v_grant_amount || ' créditos)'
    END
  );

  INSERT INTO plan_credit_grants (
    user_id, user_type, plan_type, subscription_id, grant_type, grant_period_start, amount
  ) VALUES (
    p_user_id, p_user_type, p_plan_type, p_subscription_id, p_grant_type, v_grant_period, v_grant_amount
  );

  IF p_user_type = 'freelancer' THEN
    UPDATE freelancer_plans SET last_credit_grant_at = now() WHERE freelancer_user_id = p_user_id;
  ELSE
    UPDATE company_plans SET last_credit_grant_at = now() WHERE company_user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'granted', true,
    'amount', v_grant_amount,
    'new_plan_balance', v_new_plan_balance,
    'new_total_balance', v_new_total,
    'grant_type', p_grant_type,
    'plan_type', p_plan_type
  );
END;
$$;
