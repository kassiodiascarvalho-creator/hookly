-- Finalize proposal acceptance atomically (company or freelancer)
-- Creates contract if missing and moves project to in_progress.

CREATE OR REPLACE FUNCTION public.finalize_proposal_acceptance(
  p_proposal_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal public.proposals%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_contract_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_proposal
  FROM public.proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;

  SELECT *
  INTO v_project
  FROM public.projects
  WHERE id = v_proposal.project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  -- Only participants can finalize
  IF auth.uid() <> v_proposal.freelancer_user_id AND auth.uid() <> v_project.company_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Mark proposal as accepted and store response metadata
  UPDATE public.proposals
  SET
    status = 'accepted',
    company_response = 'accepted',
    company_response_at = now(),
    updated_at = now()
  WHERE id = p_proposal_id;

  -- Move project into progress (don't override completed)
  UPDATE public.projects
  SET
    status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END,
    updated_at = now()
  WHERE id = v_project.id;

  -- Ensure a contract exists
  SELECT c.id
  INTO v_contract_id
  FROM public.contracts c
  WHERE c.proposal_id = p_proposal_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    -- This function is assumed to create the contract from proposal data.
    PERFORM public.create_contract_from_proposal(
      p_company_user_id := v_project.company_user_id::text,
      p_proposal_id := p_proposal_id::text
    );

    SELECT c.id
    INTO v_contract_id
    FROM public.contracts c
    WHERE c.proposal_id = p_proposal_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  RETURN v_contract_id;
END;
$$;

-- Optional: tighten execution permissions to authenticated users only.
REVOKE ALL ON FUNCTION public.finalize_proposal_acceptance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_proposal_acceptance(uuid) TO authenticated;
