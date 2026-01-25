-- ============================================
-- Update check_and_grant_monthly_credits to require profile completion bonus first
-- New flow:
--   1. New user → 0 credits (no automatic grant)
--   2. Profile 100% complete → +10 bonus (starts 30-day countdown)
--   3. 30 days after bonus → +10 renewal
-- ============================================

CREATE OR REPLACE FUNCTION public.check_and_grant_monthly_credits(
  p_user_id uuid,
  p_user_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_claimed BOOLEAN;
  v_bonus_date TIMESTAMP WITH TIME ZONE;
  v_last_grant TIMESTAMP WITH TIME ZONE;
  v_days_since_reference INTEGER;
  v_current_plan_balance INTEGER;
  v_plan_type TEXT;
  v_new_plan_balance INTEGER;
  v_new_total INTEGER;
BEGIN
  -- STEP 1: Check if profile completion bonus was claimed
  SELECT profile_completion_bonus_claimed INTO v_bonus_claimed
  FROM profiles WHERE user_id = p_user_id;

  IF NOT COALESCE(v_bonus_claimed, false) THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'PROFILE_NOT_COMPLETE',
      'message', 'Complete seu perfil 100% para começar a receber créditos'
    );
  END IF;

  -- STEP 2: Find the profile completion bonus transaction date
  SELECT created_at INTO v_bonus_date
  FROM platform_credit_transactions
  WHERE user_id = p_user_id 
    AND user_type = p_user_type
    AND action = 'topup'
    AND description LIKE '%Perfil 100% completo%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_bonus_date IS NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'BONUS_NOT_FOUND',
      'message', 'Bônus de perfil completo não encontrado'
    );
  END IF;

  -- STEP 3: Find the last monthly grant (if any)
  SELECT created_at INTO v_last_grant
  FROM platform_credit_transactions
  WHERE user_id = p_user_id 
    AND user_type = p_user_type
    AND action = 'monthly_grant'
  ORDER BY created_at DESC
  LIMIT 1;

  -- STEP 4: Calculate days since reference date
  -- If never received monthly_grant, use bonus date as reference
  -- If already received, use last monthly_grant date
  IF v_last_grant IS NOT NULL THEN
    v_days_since_reference := (CURRENT_DATE - v_last_grant::date);
  ELSE
    v_days_since_reference := (CURRENT_DATE - v_bonus_date::date);
  END IF;

  IF v_days_since_reference < 30 THEN
    RETURN jsonb_build_object(
      'granted', false, 
      'reason', 'NOT_ENOUGH_TIME',
      'days_remaining', 30 - v_days_since_reference,
      'reference_date', COALESCE(v_last_grant, v_bonus_date)
    );
  END IF;

  -- STEP 5: Verify plan type (only free/standard eligible for monthly grants)
  IF p_user_type = 'freelancer' THEN
    SELECT plan_type INTO v_plan_type 
    FROM freelancer_plans 
    WHERE freelancer_user_id = p_user_id AND status = 'active'
    LIMIT 1;
    
    IF v_plan_type IS NULL THEN
      SELECT tier INTO v_plan_type 
      FROM freelancer_profiles 
      WHERE user_id = p_user_id;
    END IF;
  ELSIF p_user_type = 'company' THEN
    SELECT plan_type INTO v_plan_type 
    FROM company_plans 
    WHERE company_user_id = p_user_id AND status = 'active'
    LIMIT 1;
  END IF;

  v_plan_type := COALESCE(v_plan_type, 'free');

  -- Only free/standard users get monthly grants through this function
  -- Pro/Elite users get grants through check_and_grant_plan_credits
  IF v_plan_type NOT IN ('free', 'standard') THEN
    RETURN jsonb_build_object(
      'granted', false, 
      'reason', 'NOT_FREE_PLAN',
      'plan_type', v_plan_type,
      'message', 'Planos pagos recebem créditos via check_and_grant_plan_credits'
    );
  END IF;

  -- STEP 6: Grant credits (add to plan_balance)
  INSERT INTO platform_credits (user_id, user_type, plan_balance, purchased_balance)
  VALUES (p_user_id, p_user_type, 10, 0)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    plan_balance = platform_credits.plan_balance + 10,
    updated_at = now()
  RETURNING plan_balance, plan_balance + purchased_balance INTO v_new_plan_balance, v_new_total;

  -- Record the transaction
  INSERT INTO platform_credit_transactions (
    user_id, user_type, action, amount, balance_after, description
  ) VALUES (
    p_user_id, 
    p_user_type, 
    'monthly_grant', 
    10, 
    v_new_total, 
    'Renovação mensal de créditos (plano ' || v_plan_type || ')'
  );

  RETURN jsonb_build_object(
    'granted', true, 
    'credits_added', 10,
    'new_plan_balance', v_new_plan_balance,
    'new_total_balance', v_new_total,
    'plan_type', v_plan_type,
    'next_grant_date', (CURRENT_DATE + INTERVAL '30 days')::date
  );
END;
$$;
