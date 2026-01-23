-- 1. Adicionar campos de rastreamento de oferta na tabela proposals
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS current_offer_cents BIGINT,
  ADD COLUMN IF NOT EXISTS current_offer_by TEXT 
    CHECK (current_offer_by IN ('company', 'freelancer'));

-- 2. Atualizar RPC finalize_proposal_acceptance para usar current_offer_cents
CREATE OR REPLACE FUNCTION public.finalize_proposal_acceptance(p_proposal_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_contract_id uuid;
  v_current_user_id uuid;
  v_final_amount_cents BIGINT;
  v_milestones JSONB;
  v_original_total NUMERIC;
BEGIN
  -- Get current user
  v_current_user_id := auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get proposal
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF v_proposal IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  -- Get project
  SELECT * INTO v_project FROM public.projects WHERE id = v_proposal.project_id;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Verify user is either the freelancer or company owner
  IF v_current_user_id != v_proposal.freelancer_user_id AND v_current_user_id != v_project.company_user_id THEN
    RAISE EXCEPTION 'Not authorized to accept this proposal';
  END IF;

  -- Determinar valor final: usar current_offer_cents se existir
  IF v_proposal.current_offer_cents IS NOT NULL THEN
    v_final_amount_cents := v_proposal.current_offer_cents;
    
    -- Calcular total original dos milestones
    SELECT COALESCE(SUM((m->>'amount')::numeric), 0)
    INTO v_original_total
    FROM jsonb_array_elements(v_proposal.milestones) AS m;
    
    -- Recalcular milestones proporcionalmente se houver milestones
    IF v_original_total > 0 THEN
      SELECT jsonb_agg(
        jsonb_set(m, '{amount}', 
          to_jsonb(ROUND((m->>'amount')::numeric * (v_final_amount_cents / 100.0) / v_original_total, 2)))
      )
      INTO v_milestones
      FROM jsonb_array_elements(v_proposal.milestones) AS m;
      
      -- Atualizar milestones na proposta
      UPDATE public.proposals 
      SET milestones = v_milestones 
      WHERE id = p_proposal_id;
      
      -- Recarregar proposta com milestones atualizados
      SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
    END IF;
  ELSE
    -- Fallback: calcular dos milestones existentes
    SELECT COALESCE(SUM((m->>'amount')::numeric * 100), 0)::BIGINT
    INTO v_final_amount_cents
    FROM jsonb_array_elements(v_proposal.milestones) AS m;
  END IF;

  -- Update proposal status to accepted
  UPDATE public.proposals
  SET 
    status = 'accepted',
    company_response = 'accepted',
    updated_at = now()
  WHERE id = p_proposal_id;

  -- Update project status to in_progress (only if not already completed)
  UPDATE public.projects
  SET 
    status = 'in_progress',
    updated_at = now()
  WHERE id = v_proposal.project_id
    AND status != 'completed';

  -- Check if contract already exists
  SELECT id INTO v_contract_id
  FROM public.contracts
  WHERE proposal_id = p_proposal_id;

  IF v_contract_id IS NULL THEN
    -- Create contract with correct amounts
    INSERT INTO public.contracts (
      proposal_id,
      project_id,
      company_user_id,
      freelancer_user_id,
      title,
      description,
      currency,
      amount_cents,
      agreed_amount_cents,
      original_proposal_amount_cents,
      was_counterproposal,
      milestones,
      status,
      accepted_at,
      company_accepted_at,
      freelancer_accepted_at
    )
    SELECT
      p_proposal_id,
      v_proposal.project_id,
      v_project.company_user_id,
      v_proposal.freelancer_user_id,
      v_project.title,
      v_project.description,
      v_project.currency,
      v_final_amount_cents,
      v_final_amount_cents,
      COALESCE(SUM((m->>'amount')::numeric * 100), 0)::BIGINT,
      v_proposal.is_counterproposal,
      v_proposal.milestones,
      'active',
      now(),
      CASE WHEN v_current_user_id = v_project.company_user_id THEN now() ELSE NULL END,
      CASE WHEN v_current_user_id = v_proposal.freelancer_user_id THEN now() ELSE NULL END
    FROM jsonb_array_elements(v_proposal.milestones) AS m
    GROUP BY v_proposal.project_id, v_project.company_user_id, v_proposal.freelancer_user_id, 
             v_project.title, v_project.description, v_project.currency, 
             v_proposal.is_counterproposal, v_proposal.milestones
    RETURNING id INTO v_contract_id;
  ELSE
    -- Update existing contract with correct amounts and milestones
    UPDATE public.contracts
    SET 
      amount_cents = v_final_amount_cents,
      agreed_amount_cents = v_final_amount_cents,
      milestones = v_proposal.milestones,
      updated_at = now(),
      company_accepted_at = CASE 
        WHEN v_current_user_id = v_project.company_user_id AND company_accepted_at IS NULL 
        THEN now() 
        ELSE company_accepted_at 
      END,
      freelancer_accepted_at = CASE 
        WHEN v_current_user_id = v_proposal.freelancer_user_id AND freelancer_accepted_at IS NULL 
        THEN now() 
        ELSE freelancer_accepted_at 
      END
    WHERE id = v_contract_id;
  END IF;

  RETURN v_contract_id;
END;
$$;