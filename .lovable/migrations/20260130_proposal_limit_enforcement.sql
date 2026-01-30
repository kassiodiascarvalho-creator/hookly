-- ============================================================
-- Proposal Limit Enforcement System
-- ============================================================
-- This migration adds:
-- 1. RPC to check if freelancer can send proposal (limit check)
-- 2. RPC to increment proposal count when proposal is sent
-- 3. Auto-reset mechanism for monthly proposal counts
-- ============================================================

-- Function to ensure freelancer plan exists
CREATE OR REPLACE FUNCTION public.ensure_freelancer_plan_exists(p_freelancer_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO freelancer_plans (freelancer_user_id, plan_type, status, proposals_this_month, proposals_reset_at)
  VALUES (p_freelancer_user_id, 'free', 'active', 0, now())
  ON CONFLICT (freelancer_user_id) DO NOTHING;
END;
$$;

-- Function to check and maybe reset monthly proposals
CREATE OR REPLACE FUNCTION public.maybe_reset_monthly_proposals(p_freelancer_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_at TIMESTAMPTZ;
BEGIN
  SELECT proposals_reset_at INTO v_reset_at
  FROM freelancer_plans
  WHERE freelancer_user_id = p_freelancer_user_id;

  -- If more than 30 days since last reset, reset counter
  IF v_reset_at IS NULL OR (now() - v_reset_at) > INTERVAL '30 days' THEN
    UPDATE freelancer_plans
    SET proposals_this_month = 0,
        proposals_reset_at = now(),
        updated_at = now()
    WHERE freelancer_user_id = p_freelancer_user_id;
  END IF;
END;
$$;

-- Enhanced function to check if freelancer can send proposal
-- Now includes proposal limit verification
CREATE OR REPLACE FUNCTION public.check_freelancer_can_send_proposal(p_freelancer_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion INTEGER;
  v_plan_type TEXT;
  v_proposals_used INTEGER;
  v_proposals_limit INTEGER;
  v_tier TEXT;
BEGIN
  -- Get profile completion
  SELECT profile_completion_percent 
  INTO v_completion
  FROM profiles
  WHERE user_id = p_freelancer_user_id;
  
  IF v_completion IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROFILE_NOT_FOUND',
      'completion_percent', 0,
      'proposals_used', 0,
      'proposals_limit', 0
    );
  END IF;
  
  IF v_completion < 100 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROFILE_INCOMPLETE',
      'completion_percent', v_completion,
      'proposals_used', 0,
      'proposals_limit', 0
    );
  END IF;

  -- Get freelancer tier
  SELECT tier INTO v_tier
  FROM freelancer_profiles
  WHERE user_id = p_freelancer_user_id;

  -- Pro and top_rated tiers have unlimited proposals
  IF v_tier IN ('pro', 'top_rated') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', null,
      'completion_percent', v_completion,
      'proposals_used', 0,
      'proposals_limit', null
    );
  END IF;

  -- Ensure plan exists
  PERFORM ensure_freelancer_plan_exists(p_freelancer_user_id);

  -- Maybe reset monthly counter
  PERFORM maybe_reset_monthly_proposals(p_freelancer_user_id);

  -- Get plan info
  SELECT fp.plan_type, COALESCE(fp.proposals_this_month, 0)
  INTO v_plan_type, v_proposals_used
  FROM freelancer_plans fp
  WHERE fp.freelancer_user_id = p_freelancer_user_id;

  -- Get limit from plan definition
  SELECT fpd.proposals_limit INTO v_proposals_limit
  FROM freelancer_plan_definitions fpd
  WHERE fpd.plan_type = v_plan_type
  AND fpd.is_active = true;

  -- If no limit (null), unlimited proposals
  IF v_proposals_limit IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', null,
      'completion_percent', v_completion,
      'proposals_used', v_proposals_used,
      'proposals_limit', null
    );
  END IF;

  -- Check if limit reached
  IF v_proposals_used >= v_proposals_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PROPOSAL_LIMIT_REACHED',
      'completion_percent', v_completion,
      'proposals_used', v_proposals_used,
      'proposals_limit', v_proposals_limit
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'completion_percent', v_completion,
    'proposals_used', v_proposals_used,
    'proposals_limit', v_proposals_limit
  );
END;
$$;

-- Function to increment proposal count (called after successful proposal submission)
CREATE OR REPLACE FUNCTION public.increment_freelancer_proposal_count(p_freelancer_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_new_count INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get freelancer tier
  SELECT tier INTO v_tier
  FROM freelancer_profiles
  WHERE user_id = p_freelancer_user_id;

  -- Pro and top_rated don't need counting
  IF v_tier IN ('pro', 'top_rated') THEN
    RETURN jsonb_build_object(
      'success', true,
      'proposals_used', 0,
      'proposals_limit', null,
      'unlimited', true
    );
  END IF;

  -- Ensure plan exists
  PERFORM ensure_freelancer_plan_exists(p_freelancer_user_id);

  -- Maybe reset monthly counter
  PERFORM maybe_reset_monthly_proposals(p_freelancer_user_id);

  -- Increment counter
  UPDATE freelancer_plans
  SET proposals_this_month = COALESCE(proposals_this_month, 0) + 1,
      updated_at = now()
  WHERE freelancer_user_id = p_freelancer_user_id
  RETURNING proposals_this_month INTO v_new_count;

  -- Get limit
  SELECT fpd.proposals_limit INTO v_limit
  FROM freelancer_plans fp
  JOIN freelancer_plan_definitions fpd ON fpd.plan_type = fp.plan_type AND fpd.is_active = true
  WHERE fp.freelancer_user_id = p_freelancer_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposals_used', v_new_count,
    'proposals_limit', v_limit,
    'unlimited', v_limit IS NULL
  );
END;
$$;

-- Function to get freelancer proposal usage (for UI display)
CREATE OR REPLACE FUNCTION public.get_freelancer_proposal_usage(p_freelancer_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_proposals_used INTEGER;
  v_proposals_limit INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- Get freelancer tier
  SELECT tier INTO v_tier
  FROM freelancer_profiles
  WHERE user_id = p_freelancer_user_id;

  -- Pro and top_rated have unlimited
  IF v_tier IN ('pro', 'top_rated') THEN
    RETURN jsonb_build_object(
      'proposals_used', 0,
      'proposals_limit', null,
      'unlimited', true,
      'reset_at', null
    );
  END IF;

  -- Ensure plan exists
  PERFORM ensure_freelancer_plan_exists(p_freelancer_user_id);

  -- Maybe reset monthly counter
  PERFORM maybe_reset_monthly_proposals(p_freelancer_user_id);

  -- Get usage info
  SELECT 
    COALESCE(fp.proposals_this_month, 0),
    fpd.proposals_limit,
    fp.proposals_reset_at
  INTO v_proposals_used, v_proposals_limit, v_reset_at
  FROM freelancer_plans fp
  LEFT JOIN freelancer_plan_definitions fpd 
    ON fpd.plan_type = fp.plan_type AND fpd.is_active = true
  WHERE fp.freelancer_user_id = p_freelancer_user_id;

  RETURN jsonb_build_object(
    'proposals_used', COALESCE(v_proposals_used, 0),
    'proposals_limit', v_proposals_limit,
    'unlimited', v_proposals_limit IS NULL,
    'reset_at', v_reset_at + INTERVAL '30 days'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.ensure_freelancer_plan_exists(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.maybe_reset_monthly_proposals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_freelancer_can_send_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_freelancer_proposal_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_freelancer_proposal_usage(UUID) TO authenticated;
