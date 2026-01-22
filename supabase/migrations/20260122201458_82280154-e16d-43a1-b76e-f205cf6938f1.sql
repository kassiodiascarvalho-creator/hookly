-- 1. Adicionar coluna budget_ideal na tabela projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS budget_ideal numeric;

-- 2. Migrar dados existentes: budget_ideal = média entre min e max
UPDATE public.projects 
SET budget_ideal = CASE 
  WHEN budget_min IS NOT NULL AND budget_max IS NOT NULL THEN (budget_min + budget_max) / 2
  WHEN budget_min IS NOT NULL THEN budget_min
  WHEN budget_max IS NOT NULL THEN budget_max
  ELSE NULL
END
WHERE budget_ideal IS NULL;

-- 3. Adicionar colunas de contraproposta na tabela proposals
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS is_counterproposal boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS counterproposal_justification text,
ADD COLUMN IF NOT EXISTS company_response text CHECK (company_response IN ('pending', 'accepted', 'rejected', 'negotiating')),
ADD COLUMN IF NOT EXISTS company_response_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS negotiation_notes text;

-- 4. Adicionar colunas de valor acordado para o contrato
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS agreed_amount_cents bigint,
ADD COLUMN IF NOT EXISTS original_proposal_amount_cents bigint,
ADD COLUMN IF NOT EXISTS was_counterproposal boolean DEFAULT false;

-- 5. Criar função para validar proposta contra orçamento
CREATE OR REPLACE FUNCTION public.validate_proposal_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_total_amount numeric;
BEGIN
  -- Get the project budget
  SELECT budget_min, budget_ideal, budget_max INTO v_project
  FROM projects WHERE id = NEW.project_id;
  
  -- Calculate total from milestones
  SELECT COALESCE(SUM((m->>'amount')::numeric), 0) INTO v_total_amount
  FROM jsonb_array_elements(NEW.milestones) AS m;
  
  -- If proposal exceeds max budget, it must be a counterproposal with justification
  IF v_project.budget_max IS NOT NULL AND v_total_amount > v_project.budget_max THEN
    IF NOT NEW.is_counterproposal THEN
      RAISE EXCEPTION 'Proposal exceeds budget. Must be marked as counterproposal.';
    END IF;
    IF NEW.counterproposal_justification IS NULL OR NEW.counterproposal_justification = '' THEN
      RAISE EXCEPTION 'Counterproposal requires justification.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Criar trigger para validar propostas
DROP TRIGGER IF EXISTS validate_proposal_budget_trigger ON proposals;
CREATE TRIGGER validate_proposal_budget_trigger
BEFORE INSERT OR UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION validate_proposal_budget();

-- 7. Função para criar contrato a partir de proposta aceita
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
BEGIN
  -- Get proposal
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
  
  -- Calculate total amount
  SELECT COALESCE(SUM((m->>'amount')::numeric), 0) INTO v_total_amount
  FROM jsonb_array_elements(v_proposal.milestones) AS m;
  
  -- Create contract
  INSERT INTO contracts (
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
    (v_total_amount * 100)::bigint,
    v_proposal.is_counterproposal
  )
  RETURNING id INTO v_contract_id;
  
  RETURN json_build_object('success', true, 'contract_id', v_contract_id);
END;
$$;