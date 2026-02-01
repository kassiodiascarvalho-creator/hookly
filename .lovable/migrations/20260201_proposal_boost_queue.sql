-- Add boost_credits column to proposals table for competitive queue
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS boost_credits INTEGER DEFAULT 0;

-- Create index for faster ordering by boost_credits
CREATE INDEX IF NOT EXISTS idx_proposals_boost_credits ON proposals(project_id, boost_credits DESC, created_at ASC);

-- RPC to get proposal queue for a project (freelancer view)
CREATE OR REPLACE FUNCTION get_proposal_queue(p_project_id UUID)
RETURNS TABLE (
  proposal_id UUID,
  freelancer_user_id UUID,
  freelancer_name TEXT,
  freelancer_avatar TEXT,
  boost_credits INTEGER,
  position INTEGER,
  is_current_user BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as proposal_id,
    p.freelancer_user_id,
    fp.full_name as freelancer_name,
    fp.avatar_url as freelancer_avatar,
    COALESCE(p.boost_credits, 0) as boost_credits,
    ROW_NUMBER() OVER (ORDER BY COALESCE(p.boost_credits, 0) DESC, p.created_at ASC)::INTEGER as position,
    (p.freelancer_user_id = auth.uid()) as is_current_user,
    p.created_at
  FROM proposals p
  JOIN freelancer_profiles fp ON fp.user_id = p.freelancer_user_id
  WHERE p.project_id = p_project_id
    AND p.status = 'sent'
  ORDER BY COALESCE(p.boost_credits, 0) DESC, p.created_at ASC;
END;
$$;

-- RPC to boost a proposal with credits
CREATE OR REPLACE FUNCTION boost_proposal(
  p_proposal_id UUID,
  p_boost_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_boost INTEGER;
  v_min_boost INTEGER := 2;
  v_proposal_project_id UUID;
  v_current_balance INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Validate boost amount
  IF p_boost_amount < v_min_boost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum boost is 2 credits');
  END IF;
  
  -- Check proposal belongs to user
  SELECT boost_credits, project_id INTO v_current_boost, v_proposal_project_id
  FROM proposals
  WHERE id = p_proposal_id AND freelancer_user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found or not yours');
  END IF;
  
  -- Check user has enough credits
  SELECT COALESCE(plan_balance, 0) + COALESCE(purchased_balance, 0) INTO v_current_balance
  FROM platform_credits
  WHERE user_id = v_user_id AND user_type = 'freelancer';
  
  IF v_current_balance IS NULL OR v_current_balance < p_boost_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'required', p_boost_amount, 'available', COALESCE(v_current_balance, 0));
  END IF;
  
  -- Spend credits using existing RPC
  PERFORM spend_platform_credits(
    v_user_id,
    'freelancer',
    p_boost_amount,
    'proposal_boost',
    'Boost de proposta: ' || p_proposal_id::text
  );
  
  -- Update proposal boost credits (cumulative)
  UPDATE proposals
  SET boost_credits = COALESCE(boost_credits, 0) + p_boost_amount,
      updated_at = now()
  WHERE id = p_proposal_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'new_boost_total', COALESCE(v_current_boost, 0) + p_boost_amount
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_proposal_queue(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION boost_proposal(UUID, INTEGER) TO authenticated;
