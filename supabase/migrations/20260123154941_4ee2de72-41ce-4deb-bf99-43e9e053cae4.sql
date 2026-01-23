-- ============================================================
-- MIGRAÇÃO: Corrigir inconsistências de contratos legados
-- Regras aplicadas, não IDs fixos
-- ============================================================

-- 1. Contratos com proposal.status='accepted' mas contract.status='pending_acceptance'
--    REGRA: Se a proposta foi aceita, o contrato deve estar 'active' (ou superior)
UPDATE public.contracts c
SET 
  status = 'active',
  accepted_at = COALESCE(c.accepted_at, now()),
  updated_at = now()
FROM public.proposals p
WHERE c.proposal_id = p.id
  AND p.status = 'accepted'
  AND c.status = 'pending_acceptance';

-- 2. Contratos com proposal.is_counterproposal=true mas contract.was_counterproposal=false
--    REGRA: O flag deve ser consistente
UPDATE public.contracts c
SET 
  was_counterproposal = true,
  updated_at = now()
FROM public.proposals p
WHERE c.proposal_id = p.id
  AND p.is_counterproposal = true
  AND (c.was_counterproposal IS NULL OR c.was_counterproposal = false);

-- 3. Contratos sem agreed_amount_cents mas com current_offer_cents na proposta
--    REGRA: Se houve negociação, o valor acordado deve refletir
UPDATE public.contracts c
SET 
  agreed_amount_cents = p.current_offer_cents,
  amount_cents = p.current_offer_cents,
  updated_at = now()
FROM public.proposals p
WHERE c.proposal_id = p.id
  AND p.current_offer_cents IS NOT NULL
  AND (c.agreed_amount_cents IS NULL OR c.agreed_amount_cents != p.current_offer_cents);

-- 4. Garantir company_accepted_at e freelancer_accepted_at preenchidos em contratos ativos
UPDATE public.contracts
SET 
  company_accepted_at = COALESCE(company_accepted_at, accepted_at, now()),
  freelancer_accepted_at = COALESCE(freelancer_accepted_at, accepted_at, now()),
  updated_at = now()
WHERE status IN ('active', 'funded', 'completed')
  AND (company_accepted_at IS NULL OR freelancer_accepted_at IS NULL);