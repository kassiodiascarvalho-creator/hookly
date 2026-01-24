-- ============================================
-- MIGRATION: Add plan_source column to company_plans
-- Mirrors freelancer_profiles.tier_source behavior
-- ============================================

-- 1) Add the plan_source column with default 'manual'
ALTER TABLE public.company_plans 
ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'manual';

-- 2) Backfill: Set plan_source='stripe' for existing Stripe subscriptions
UPDATE public.company_plans 
SET plan_source = 'stripe' 
WHERE stripe_subscription_id IS NOT NULL 
  AND stripe_subscription_id != ''
  AND plan_source = 'manual';

-- 3) Update check_and_grant_plan_credits to support manual company plans
-- Creates synthetic subscription_id for manual pro/elite companies
CREATE OR REPLACE FUNCTION public.check_and_grant_plan_credits(
  p_user_id uuid,
  p_user_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_type TEXT;
  v_subscription_id TEXT;
  v_subscription_status TEXT;
  v_tier TEXT;
  v_tier_source TEXT;
  v_plan_source TEXT;
  v_last_grant TIMESTAMP WITH TIME ZONE;
  v_days_since_grant INTEGER;
  v_result JSONB;
BEGIN
  -- ============ FREELANCER LOGIC ============
  IF p_user_type = 'freelancer' THEN
    -- Get freelancer plan info
    SELECT fp.plan_type, fp.stripe_subscription_id, fp.status
    INTO v_plan_type, v_subscription_id, v_subscription_status
    FROM freelancer_plans fp
    WHERE fp.freelancer_user_id = p_user_id
    LIMIT 1;

    -- Get tier info for fallback
    SELECT fpr.tier, fpr.tier_source
    INTO v_tier, v_tier_source
    FROM freelancer_profiles fpr
    WHERE fpr.user_id = p_user_id;

    -- If no plan record or free plan, try tier-based logic
    IF v_plan_type IS NULL OR v_plan_type = 'free' THEN
      v_tier := COALESCE(v_tier, 'standard');
      
      -- Map tier to plan type for credits
      IF v_tier IN ('pro', 'top_rated') THEN
        v_plan_type := CASE WHEN v_tier = 'top_rated' THEN 'elite' ELSE 'pro' END;
        
        -- For manual tiers, generate synthetic subscription_id
        IF COALESCE(v_tier_source, 'manual') = 'manual' AND v_subscription_id IS NULL THEN
          v_subscription_id := 'manual:freelancer:tier:' || v_tier || ':' || p_user_id::text;
          v_subscription_status := 'active';
        END IF;
      ELSE
        -- Standard tier, return free plan monthly grant
        RETURN public.check_and_grant_monthly_credits(p_user_id, p_user_type);
      END IF;
    END IF;

    -- Check if subscription is active
    IF v_subscription_status IS NULL OR v_subscription_status NOT IN ('active', 'trialing') THEN
      -- For manual tiers with pro/elite, force active status
      IF v_tier IN ('pro', 'top_rated') AND COALESCE(v_tier_source, 'manual') = 'manual' THEN
        v_subscription_status := 'active';
        v_subscription_id := COALESCE(v_subscription_id, 'manual:freelancer:tier:' || v_tier || ':' || p_user_id::text);
      ELSE
        RETURN jsonb_build_object(
          'granted', false,
          'reason', 'SUBSCRIPTION_NOT_ACTIVE',
          'status', v_subscription_status
        );
      END IF;
    END IF;

    -- Ensure we have subscription_id
    IF v_subscription_id IS NULL THEN
      RETURN jsonb_build_object(
        'granted', false,
        'reason', 'NO_SUBSCRIPTION_ID'
      );
    END IF;

    -- Check last grant for this subscription (30-day idempotency)
    SELECT MAX(created_at) INTO v_last_grant
    FROM plan_credit_grants
    WHERE user_id = p_user_id
      AND subscription_id = v_subscription_id
      AND grant_type = 'monthly';

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
    RETURN public.grant_plan_credits(
      p_user_id, 
      p_user_type, 
      v_plan_type, 
      v_subscription_id, 
      'monthly'
    );

  -- ============ COMPANY LOGIC ============
  ELSIF p_user_type = 'company' THEN
    -- Get company plan info
    SELECT cp.plan_type, cp.stripe_subscription_id, cp.status, cp.plan_source
    INTO v_plan_type, v_subscription_id, v_subscription_status, v_plan_source
    FROM company_plans cp
    WHERE cp.company_user_id = p_user_id
    LIMIT 1;

    -- Default values
    v_plan_type := COALESCE(v_plan_type, 'free');
    v_plan_source := COALESCE(v_plan_source, 'manual');

    -- For free plan, use monthly grant
    IF v_plan_type = 'free' THEN
      RETURN public.check_and_grant_monthly_credits(p_user_id, p_user_type);
    END IF;

    -- For pro/elite plans
    IF v_plan_type IN ('pro', 'elite', 'starter') THEN
      -- If manual plan (no stripe subscription), create synthetic subscription_id
      IF v_plan_source = 'manual' AND (v_subscription_id IS NULL OR v_subscription_id = '') THEN
        v_subscription_id := 'manual:company:plan:' || v_plan_type || ':' || p_user_id::text;
        v_subscription_status := 'active';
      END IF;
    END IF;

    -- Check subscription status
    IF v_subscription_status IS NULL OR v_subscription_status NOT IN ('active', 'trialing') THEN
      -- For manual plans, force active
      IF v_plan_source = 'manual' AND v_plan_type IN ('pro', 'elite', 'starter') THEN
        v_subscription_status := 'active';
        v_subscription_id := COALESCE(v_subscription_id, 'manual:company:plan:' || v_plan_type || ':' || p_user_id::text);
      ELSE
        RETURN jsonb_build_object(
          'granted', false,
          'reason', 'SUBSCRIPTION_NOT_ACTIVE',
          'status', v_subscription_status
        );
      END IF;
    END IF;

    -- Ensure subscription_id exists
    IF v_subscription_id IS NULL THEN
      RETURN jsonb_build_object(
        'granted', false,
        'reason', 'NO_SUBSCRIPTION_ID'
      );
    END IF;

    -- Check last grant (30-day idempotency)
    SELECT MAX(created_at) INTO v_last_grant
    FROM plan_credit_grants
    WHERE user_id = p_user_id
      AND subscription_id = v_subscription_id
      AND grant_type = 'monthly';

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
    RETURN public.grant_plan_credits(
      p_user_id,
      p_user_type,
      v_plan_type,
      v_subscription_id,
      'monthly'
    );

  ELSE
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'INVALID_USER_TYPE',
      'user_type', p_user_type
    );
  END IF;
END;
$$;

-- Add comment for documentation
COMMENT ON COLUMN public.company_plans.plan_source IS 
  'Source of plan assignment: "stripe" for Stripe subscriptions, "manual" for admin overrides. Only Stripe-sourced plans will be auto-downgraded on subscription cancellation.';
