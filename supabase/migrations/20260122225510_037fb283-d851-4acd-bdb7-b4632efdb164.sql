-- Atualiza a função create_contract_from_proposal para:
-- 1. Salvar o valor original do budget_max do projeto como original_proposal_amount_cents
-- 2. Salvar o valor proposto pelo freelancer (counter-proposal) como agreed_amount_cents
-- 3. Marcar was_counterproposal = true quando for uma contra-proposta

CREATE OR REPLACE FUNCTION public.create_contract_from_proposal(
  p_proposal_id UUID,
  p_company_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal RECORD;
  v_project RECORD;
  v_total_amount numeric;
  v_contract_id UUID;
  v_original_budget_cents bigint;
BEGIN
  -- Get proposal with counterproposal info
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;
  
  IF v_proposal IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PROPOSAL_NOT_FOUND');
  END IF;
  
  -- Get project
  SELECT * INTO v_project FROM projects WHERE id = v_proposal.project_id;
  
  -- Verify ownership
  IF v_project.company_user_id != p_company_user_id THEN
    RETURN json_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;
  
  -- Calculate total amount from milestones (this is the agreed amount)
  SELECT COALESCE(SUM((m->>'amount')::numeric), 0) INTO v_total_amount
  FROM jsonb_array_elements(v_proposal.milestones) AS m;
  
  -- Get original budget (budget_max) from project in cents
  v_original_budget_cents := COALESCE((v_project.budget_max * 100)::bigint, (v_total_amount * 100)::bigint);
  
  -- Create contract with counterproposal tracking
  INSERT INTO contracts (
    proposal_id,
    project_id,
    company_user_id,
    freelancer_user_id,
    title,
    description,
    amount_cents,
    currency,
    milestones,
    status,
    agreed_amount_cents,
    original_proposal_amount_cents,
    was_counterproposal
  )
  VALUES (
    p_proposal_id,
    v_proposal.project_id,
    v_project.company_user_id,
    v_proposal.freelancer_user_id,
    v_project.title,
    v_project.description,
    (v_total_amount * 100)::bigint,
    v_project.currency,
    v_proposal.milestones,
    'pending_acceptance',
    (v_total_amount * 100)::bigint,
    v_original_budget_cents,
    COALESCE(v_proposal.is_counterproposal, false)
  )
  RETURNING id INTO v_contract_id;
  
  RETURN json_build_object(
    'success', true, 
    'contract_id', v_contract_id,
    'was_counterproposal', COALESCE(v_proposal.is_counterproposal, false),
    'agreed_amount', v_total_amount,
    'original_budget', v_project.budget_max
  );
END;
$$;