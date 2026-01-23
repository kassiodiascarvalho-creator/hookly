-- Corrigir o contrato específico onde o valor acordado não foi salvo corretamente
-- A proposta com feedback "fecho com voce por 900" deve ter agreed_amount_cents = 90000

UPDATE public.contracts
SET 
  agreed_amount_cents = 90000,
  amount_cents = 90000,
  milestones = '[{"title": "pagamento no final", "amount": 900, "description": "tenho experiencia a mais de 4 anos em edição de video para empresas"}]'::jsonb,
  status = 'active',
  updated_at = now()
WHERE proposal_id = '1b78a34c-e232-4069-b284-534f13d4886e';

-- Atualizar a proposta para ter o current_offer_cents correto
UPDATE public.proposals
SET 
  current_offer_cents = 90000,
  current_offer_by = 'company',
  milestones = '[{"title": "pagamento no final", "amount": 900, "description": "tenho experiencia a mais de 4 anos em edição de video para empresas"}]'::jsonb,
  updated_at = now()
WHERE id = '1b78a34c-e232-4069-b284-534f13d4886e';