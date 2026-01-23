

# Plano: Unificar Caminhos de Aceitação + Correção de Dados Legados

## Diagnóstico Completo

### Caminhos de Aceitação Identificados

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│                      ANÁLISE DE CAMINHOS DE ACEITAÇÃO                          │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  CAMINHO 1: ProjectDetail.tsx → handleAcceptProposal()                         │
│  ├── UPDATE proposals SET status='accepted'                                   │
│  ├── UPDATE projects SET status='in_progress'                                 │
│  ├── Cria conversation                                                        │
│  └── NÃO CRIA CONTRATO ❌ (ignora current_offer_cents)                        │
│                                                                                │
│  CAMINHO 2: CounterproposalResponseModal.tsx (Empresa aceita)                  │
│  └── supabase.rpc("finalize_proposal_acceptance") ✅                          │
│                                                                                │
│  CAMINHO 3: FreelancerCounterproposalResponseModal.tsx (Freelancer aceita)     │
│  └── supabase.rpc("finalize_proposal_acceptance") ✅                          │
│                                                                                │
│  CAMINHO 4: ContractAcceptanceModal.tsx (Aceite de contrato já existente)      │
│  └── UPDATE contracts (company/freelancer_accepted_at) ✅                     │
│      (Este é um fluxo diferente - aceite bilateral do contrato, não proposta)  │
│                                                                                │
│  ADMIN: Nenhum caminho de aceitação de proposta no admin                       │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Inconsistências no Banco de Dados (Produção)

| contract_id | contract_status | proposal_status | is_counterproposal | was_counterproposal | current_offer_cents |
|-------------|-----------------|-----------------|--------------------|--------------------|---------------------|
| 08fd645a... | active | accepted | true | **false** ❌ | 90000 |
| 16438a54... | **pending_acceptance** ❌ | accepted | true | true | null |
| a39288d2... | **pending_acceptance** ❌ | accepted | false | false | null |
| 0ef3b482... | funded | accepted | false | false | null |
| f14dcaa7... | funded | accepted | false | false | null |
| d0034ae6... | funded | accepted | false | false | null |

---

## Solução Robusta (4 Ajustes Obrigatórios)

### 1. Atualizar RPC para Retornar contract_id + agreed_amount_cents

A RPC já retorna o `contract_id` (uuid). Vamos adicionar um tipo de retorno mais rico para o frontend poder redirecionar/refetch corretamente.

### 2. Unificar handleAcceptProposal para usar RPC

Substituir os updates manuais por chamada à RPC centralizada.

### 3. Busca Global: Nenhum Outro Caminho de Update Manual

Confirmado: apenas `ProjectDetail.tsx` faz update manual de proposals.status.

### 4. Migração de Dados Legados Baseada em Regras (não IDs)

```sql
-- Regra 1: Contratos com proposal.status='accepted' devem ter status='active' ou 'funded'
-- Regra 2: Se proposal.is_counterproposal=true, contract.was_counterproposal=true
-- Regra 3: accepted_at deve estar preenchido se status != 'pending_acceptance'
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Correção de dados legados baseada em regras |
| `src/pages/ProjectDetail.tsx` | Substituir handleAcceptProposal por chamada à RPC |

---

## Seção Técnica

### Migração SQL - Correção de Dados Legados (Baseada em Regras)

```sql
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
```

### ProjectDetail.tsx - handleAcceptProposal (Unificado)

```typescript
const handleAcceptProposal = async (proposalId: string, freelancerUserId: string) => {
  if (!project || !user) return;
  setActionLoading(proposalId);

  try {
    // Usar RPC centralizada - fonte única de verdade
    const { data: contractId, error: rpcError } = await supabase.rpc(
      "finalize_proposal_acceptance",
      { p_proposal_id: proposalId }
    );

    if (rpcError) throw rpcError;

    // Criar ou buscar conversa
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("company_user_id", user.id)
      .eq("freelancer_user_id", freelancerUserId)
      .eq("project_id", project.id)
      .maybeSingle();

    if (!existingConv) {
      await supabase.from("conversations").insert({
        company_user_id: user.id,
        freelancer_user_id: freelancerUserId,
        project_id: project.id,
      });
    }

    // Notificação para freelancer
    await supabase.from("notifications").insert({
      user_id: freelancerUserId,
      type: "proposal_accepted",
      message: `Your proposal for "${project.title}" has been accepted!`,
      link: `/contracts`,
    });

    toast.success(t("proposals.accepted"));
    
    // Refetch para garantir dados atualizados
    fetchProposals();
    fetchProject();
    
    // Opcional: redirecionar para o contrato criado
    // navigate(`/contracts/${contractId}`);
    
  } catch (error) {
    console.error("Error accepting proposal:", error);
    toast.error(t("common.error", "An error occurred"));
  } finally {
    setActionLoading(null);
  }
};
```

---

## Fluxo Resultante

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│                     ARQUITETURA UNIFICADA (APÓS CORREÇÃO)                      │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  QUALQUER caminho de aceitação de proposta:                                    │
│  ├── Botão "Accept" em ProjectDetail.tsx ─────────────┐                        │
│  ├── Modal CounterproposalResponseModal.tsx ──────────┼──→ finalize_proposal_  │
│  └── Modal FreelancerCounterproposalResponseModal.tsx ┘    acceptance (RPC)    │
│                                                                                │
│                              │                                                 │
│                              ▼                                                 │
│              ┌───────────────────────────────────┐                             │
│              │  RPC finalize_proposal_acceptance │                             │
│              │  ─────────────────────────────────│                             │
│              │  1. Verifica current_offer_cents  │                             │
│              │  2. Recalcula milestones          │                             │
│              │  3. proposal.status = 'accepted'  │                             │
│              │  4. project.status = 'in_progress'│                             │
│              │  5. Cria/atualiza contract        │                             │
│              │  6. Retorna contract_id           │                             │
│              └───────────────────────────────────┘                             │
│                              │                                                 │
│                              ▼                                                 │
│              ┌───────────────────────────────────┐                             │
│              │  RESULTADO GARANTIDO:             │                             │
│              │  • proposal.status = 'accepted'   │                             │
│              │  • project.status = 'in_progress' │                             │
│              │  • contract.status = 'active'     │                             │
│              │  • contract.agreed_amount_cents ✅│                             │
│              │  • milestones recalculados ✅     │                             │
│              │  • was_counterproposal correto ✅ │                             │
│              └───────────────────────────────────┘                             │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Benefícios da Solução

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Caminhos de aceitação | 2 (um quebrado) | 1 (RPC única) |
| Contratos órfãos | Possível | Impossível |
| Valores divergentes | Frequente | Impossível |
| Correção de legados | Por ID | Por regra |
| Idempotência | Não | Sim (RPC verifica se contrato já existe) |

---

## Resumo de Ações

1. **Migração SQL**: Corrigir todos os contratos legados com base em regras (joins)
2. **ProjectDetail.tsx**: Substituir handleAcceptProposal por chamada à RPC
3. **Validação**: Busca global confirmou que não há outros caminhos de update manual

