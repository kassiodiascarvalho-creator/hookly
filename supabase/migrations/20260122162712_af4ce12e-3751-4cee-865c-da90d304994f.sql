-- Add last_monthly_credit_grant_at to profiles table for lazy renewal
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_monthly_credit_grant_at TIMESTAMP WITH TIME ZONE;

-- Add action cost for monthly renewal (configurable by admin)
INSERT INTO public.platform_action_costs (action_key, cost_credits, display_name, description, is_enabled)
VALUES ('monthly_free_renewal', 10, 'Renovação Mensal Free', 'Créditos concedidos mensalmente para usuários do plano Free', true)
ON CONFLICT (action_key) DO NOTHING;

-- Function to check if freelancer can send proposal (profile 100% complete)
CREATE OR REPLACE FUNCTION public.check_freelancer_can_send_proposal(p_freelancer_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_completion INTEGER;
  v_bonus_claimed BOOLEAN;
BEGIN
  -- Get profile completion from profiles table
  SELECT profile_completion_percent, profile_completion_bonus_claimed 
  INTO v_completion, v_bonus_claimed
  FROM profiles
  WHERE user_id = p_freelancer_user_id;
  
  IF v_completion IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROFILE_NOT_FOUND',
      'completion_percent', 0
    );
  END IF;
  
  IF v_completion < 100 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROFILE_INCOMPLETE',
      'completion_percent', v_completion
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'completion_percent', v_completion
  );
END;
$$;

-- Function to check if company can publish project (profile 100% complete)
CREATE OR REPLACE FUNCTION public.check_company_can_publish_project(p_company_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_completion INTEGER;
  v_bonus_claimed BOOLEAN;
BEGIN
  -- Get profile completion from profiles table
  SELECT profile_completion_percent, profile_completion_bonus_claimed 
  INTO v_completion, v_bonus_claimed
  FROM profiles
  WHERE user_id = p_company_user_id;
  
  IF v_completion IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROFILE_NOT_FOUND',
      'completion_percent', 0
    );
  END IF;
  
  IF v_completion < 100 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'COMPANY_PROFILE_INCOMPLETE',
      'completion_percent', v_completion
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'completion_percent', v_completion
  );
END;
$$;

-- Function for lazy monthly credit renewal (for free plan users)
CREATE OR REPLACE FUNCTION public.check_and_grant_monthly_credits(p_user_id UUID, p_user_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_grant TIMESTAMP WITH TIME ZONE;
  v_plan_type TEXT;
  v_monthly_credits INTEGER;
  v_is_enabled BOOLEAN;
  v_now TIMESTAMP WITH TIME ZONE := now();
  v_next_grant TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get monthly credit amount from platform_action_costs
  SELECT cost_credits, is_enabled INTO v_monthly_credits, v_is_enabled
  FROM platform_action_costs
  WHERE action_key = 'monthly_free_renewal';
  
  IF v_monthly_credits IS NULL THEN
    v_monthly_credits := 10; -- default
    v_is_enabled := true;
  END IF;
  
  -- If disabled, return
  IF NOT v_is_enabled THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'MONTHLY_RENEWAL_DISABLED',
      'next_grant_at', null
    );
  END IF;
  
  -- Check user's plan type
  IF p_user_type = 'freelancer' THEN
    SELECT plan_type INTO v_plan_type
    FROM freelancer_plans
    WHERE freelancer_user_id = p_user_id AND status = 'active';
  ELSIF p_user_type = 'company' THEN
    SELECT plan_type INTO v_plan_type
    FROM company_plans
    WHERE company_user_id = p_user_id AND status = 'active';
  END IF;
  
  -- If user has a paid plan, no monthly renewal
  IF v_plan_type IS NOT NULL AND v_plan_type != 'free' THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'PAID_PLAN',
      'plan_type', v_plan_type,
      'next_grant_at', null
    );
  END IF;
  
  -- Get last grant date
  SELECT last_monthly_credit_grant_at INTO v_last_grant
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- If never granted, grant now
  IF v_last_grant IS NULL THEN
    -- Grant credits
    PERFORM add_platform_credits(p_user_id, p_user_type, v_monthly_credits, NULL, 
      'Renovação mensal: +' || v_monthly_credits || ' créditos 🎁');
    
    -- Update last grant date
    UPDATE profiles
    SET last_monthly_credit_grant_at = v_now
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'granted', true,
      'amount', v_monthly_credits,
      'next_grant_at', v_now + interval '30 days'
    );
  END IF;
  
  -- Check if 30 days have passed
  IF v_now >= v_last_grant + interval '30 days' THEN
    -- Grant credits
    PERFORM add_platform_credits(p_user_id, p_user_type, v_monthly_credits, NULL, 
      'Renovação mensal: +' || v_monthly_credits || ' créditos 🎁');
    
    -- Update last grant date
    UPDATE profiles
    SET last_monthly_credit_grant_at = v_now
    WHERE user_id = p_user_id;
    
    RETURN jsonb_build_object(
      'granted', true,
      'amount', v_monthly_credits,
      'next_grant_at', v_now + interval '30 days'
    );
  END IF;
  
  v_next_grant := v_last_grant + interval '30 days';
  
  RETURN jsonb_build_object(
    'granted', false,
    'reason', 'NOT_DUE_YET',
    'last_grant_at', v_last_grant,
    'next_grant_at', v_next_grant
  );
END;
$$;