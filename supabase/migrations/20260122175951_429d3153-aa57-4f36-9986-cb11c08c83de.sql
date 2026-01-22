
-- First drop the existing function
DROP FUNCTION IF EXISTS public.check_and_grant_monthly_credits(uuid, text);

-- Recreate with fixed logic to properly detect tier from freelancer_profiles
CREATE OR REPLACE FUNCTION public.check_and_grant_monthly_credits(p_user_id uuid, p_user_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_grant timestamp with time zone;
  v_current_balance integer;
  v_plan_type text;
  v_new_balance integer;
  v_days_since_grant integer;
BEGIN
  -- Get the last monthly grant for this user
  SELECT created_at INTO v_last_grant
  FROM platform_credit_transactions
  WHERE user_id = p_user_id 
    AND user_type = p_user_type
    AND action = 'monthly_grant'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Check if 30 days have passed since the last grant
  IF v_last_grant IS NOT NULL THEN
    v_days_since_grant := EXTRACT(DAY FROM (now() - v_last_grant));
    IF v_days_since_grant < 30 THEN
      RETURN json_build_object(
        'granted', false, 
        'reason', 'NOT_ENOUGH_TIME',
        'days_remaining', 30 - v_days_since_grant
      );
    END IF;
  END IF;

  -- Determine the user's plan type
  IF p_user_type = 'freelancer' THEN
    -- Priority 1: Check freelancer_plans for active subscription
    SELECT plan_type INTO v_plan_type 
    FROM freelancer_plans 
    WHERE freelancer_user_id = p_user_id AND status = 'active'
    LIMIT 1;
    
    -- Priority 2: Check freelancer_profiles.tier if no active subscription
    IF v_plan_type IS NULL THEN
      SELECT tier INTO v_plan_type 
      FROM freelancer_profiles 
      WHERE user_id = p_user_id;
    END IF;
  ELSIF p_user_type = 'company' THEN
    -- Check company_plans for active subscription
    SELECT plan_type INTO v_plan_type 
    FROM company_plans 
    WHERE company_user_id = p_user_id AND status = 'active'
    LIMIT 1;
  END IF;

  -- Default to 'free' only if nothing found
  v_plan_type := COALESCE(v_plan_type, 'free');

  -- Only free and standard tiers are eligible for monthly credits
  IF v_plan_type NOT IN ('free', 'standard') THEN
    RETURN json_build_object(
      'granted', false, 
      'reason', 'NOT_FREE_PLAN',
      'plan_type', v_plan_type
    );
  END IF;

  -- Get current balance or create new record
  SELECT balance INTO v_current_balance
  FROM platform_credits
  WHERE user_id = p_user_id AND user_type = p_user_type;

  IF v_current_balance IS NULL THEN
    INSERT INTO platform_credits (user_id, user_type, balance)
    VALUES (p_user_id, p_user_type, 10)
    RETURNING balance INTO v_new_balance;
  ELSE
    UPDATE platform_credits
    SET balance = balance + 10, updated_at = now()
    WHERE user_id = p_user_id AND user_type = p_user_type
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Record the transaction
  INSERT INTO platform_credit_transactions (
    user_id, user_type, action, amount, balance_after, description
  ) VALUES (
    p_user_id, 
    p_user_type, 
    'monthly_grant', 
    10, 
    v_new_balance, 
    'Renovação mensal de créditos (' || v_plan_type || ')'
  );

  RETURN json_build_object(
    'granted', true, 
    'credits_added', 10,
    'new_balance', v_new_balance,
    'plan_type', v_plan_type
  );
END;
$$;

-- Correct the affected user's credits (deduct the 10 incorrectly granted)
UPDATE platform_credits 
SET balance = balance - 10, updated_at = now()
WHERE user_id = '1ed158c8-348c-443a-85f7-b34187be6f2d' 
  AND user_type = 'freelancer';

-- Log the correction in the transaction history
INSERT INTO platform_credit_transactions (
  user_id, 
  user_type, 
  action, 
  amount, 
  balance_after, 
  description
) VALUES (
  '1ed158c8-348c-443a-85f7-b34187be6f2d',
  'freelancer',
  'adjustment',
  -10,
  (SELECT balance FROM platform_credits WHERE user_id = '1ed158c8-348c-443a-85f7-b34187be6f2d' AND user_type = 'freelancer'),
  'Correção: remoção de créditos concedidos indevidamente (tier pro não elegível para renovação Free)'
);
