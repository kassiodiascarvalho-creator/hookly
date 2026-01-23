
# Plano: Corrigir Consolidação de Valor na Negociação

## Problema Identificado

Quando a empresa faz uma contraproposta com valor específico (ex: R$ 900) e o freelancer aceita, o sistema não está usando esse valor - está usando o valor original dos milestones do freelancer.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUXO ATUAL (COM BUG)                        │
├─────────────────────────────────────────────────────────────────────┤
│  1. Freelancer propõe R$ 950 (contraproposta)                       │
│  2. Empresa seleciona "Negociar" e sugere R$ 900 no feedback        │
│  3. Freelancer clica "Aceitar termos da empresa"                    │
│  4. Sistema cria contrato com milestones = R$ 950 ❌                │
│     (O valor de R$ 900 da empresa se PERDEU!)                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Solução

### 1. Adicionar Campos de Rastreamento de Oferta

Adicionar na tabela `proposals`:
- `current_offer_cents`: Valor atual da oferta em centavos
- `current_offer_by`: Quem fez a oferta ('company' ou 'freelancer')

### 2. Atualizar Modal da Empresa

Quando a empresa selecionar "Negociar", adicionar campo **obrigatório** para o valor proposto:

```text
┌────────────────────────────────────────────────┐
│  💰 Valor Proposto *                           │
│  ┌──────────────────────────────────────────┐  │
│  │ R$  [    900,00    ]                     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  📝 Feedback                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ Podemos fechar por R$ 900...             │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### 3. Atualizar Modal do Freelancer

Mostrar claramente o valor que a empresa está oferecendo:

```text
┌────────────────────────────────────────────────┐
│  💰 Oferta da Empresa                          │
│  ╔══════════════════════════════════════════╗  │
│  ║  R$ 900,00                               ║  │
│  ╚══════════════════════════════════════════╝  │
│                                                │
│  "Podemos fechar por R$ 900..."                │
│                                                │
│  ○ Aceitar R$ 900,00                           │
│  ○ Enviar nova contra-argumentação             │
└────────────────────────────────────────────────┘
```

### 4. Atualizar RPC de Finalização

A função `finalize_proposal_acceptance` vai:
1. Verificar se existe `current_offer_cents`
2. Recalcular milestones proporcionalmente
3. Criar contrato com `agreed_amount_cents = current_offer_cents`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migração SQL | Adicionar colunas + atualizar RPC |
| `CounterproposalResponseModal.tsx` | Adicionar campo de valor ao negociar |
| `FreelancerCounterproposalResponseModal.tsx` | Mostrar oferta da empresa + usar valor correto |
| `MyProposals.tsx` | Buscar e mostrar `current_offer_cents` quando em negociação |

---

## Resultado Esperado

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      FLUXO CORRIGIDO                                │
├─────────────────────────────────────────────────────────────────────┤
│  1. Freelancer propõe R$ 950                                        │
│  2. Empresa propõe R$ 900 → current_offer_cents = 90000             │
│  3. Freelancer aceita → finalize usa 90000                          │
│  4. Contrato criado com agreed_amount_cents = 90000 ✅              │
│  5. UI mostra "Valor Acordado: R$ 900" ✅                           │
│  6. Empresa vê "Aceito" com valor R$ 900 ✅                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Seção Técnica

### Migração SQL

```sql
-- 1. Adicionar campos de rastreamento
ALTER TABLE public.proposals 
  ADD COLUMN IF NOT EXISTS current_offer_cents BIGINT,
  ADD COLUMN IF NOT EXISTS current_offer_by TEXT 
    CHECK (current_offer_by IN ('company', 'freelancer'));

-- 2. Atualizar RPC para usar current_offer_cents
CREATE OR REPLACE FUNCTION public.finalize_proposal_acceptance(p_proposal_id uuid)
RETURNS uuid AS $$
DECLARE
  v_final_amount_cents BIGINT;
  v_milestones JSONB;
  v_original_total NUMERIC;
BEGIN
  -- Se há oferta pendente, usar esse valor
  IF v_proposal.current_offer_cents IS NOT NULL THEN
    v_final_amount_cents := v_proposal.current_offer_cents;
    
    -- Recalcular milestones proporcionalmente
    SELECT SUM((m->>'amount')::numeric) INTO v_original_total
    FROM jsonb_array_elements(v_proposal.milestones) AS m;
    
    IF v_original_total > 0 THEN
      SELECT jsonb_agg(
        jsonb_set(m, '{amount}', 
          to_jsonb(ROUND((m->>'amount')::numeric * 
            (v_final_amount_cents / 100.0) / v_original_total, 2)))
      ) INTO v_milestones
      FROM jsonb_array_elements(v_proposal.milestones) AS m;
      
      UPDATE proposals SET milestones = v_milestones WHERE id = p_proposal_id;
    END IF;
  END IF;
  
  -- Criar contrato com agreed_amount_cents = v_final_amount_cents
  -- ...
END;
$$;
```

### Modal da Empresa (CounterproposalResponseModal)

```typescript
const [suggestedAmount, setSuggestedAmount] = useState("");

// Campo de valor quando "Negociar"
{responseType === "negotiating" && (
  <div className="space-y-2">
    <Label>Valor Proposto *</Label>
    <Input
      type="number"
      value={suggestedAmount}
      onChange={(e) => setSuggestedAmount(e.target.value)}
      placeholder="Ex: 900"
    />
  </div>
)}

// Ao enviar:
await supabase.from("proposals").update({
  company_response: "negotiating",
  company_feedback: feedback,
  current_offer_cents: Math.round(parseFloat(suggestedAmount) * 100),
  current_offer_by: "company",
}).eq("id", proposal.id);
```

### Modal do Freelancer (FreelancerCounterproposalResponseModal)

```typescript
// Mostrar oferta da empresa
{proposal.current_offer_cents && proposal.current_offer_by === "company" && (
  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
    <p className="text-sm font-medium text-green-700">Oferta da Empresa</p>
    <p className="text-2xl font-bold text-green-600">
      {formatMoneyFromCents(proposal.current_offer_cents, project.currency)}
    </p>
  </div>
)}

// Aceitar usa o valor da oferta
if (responseType === "accept") {
  // Chama RPC que usará current_offer_cents automaticamente
  await supabase.rpc("finalize_proposal_acceptance", { 
    p_proposal_id: proposal.id 
  });
}
```
