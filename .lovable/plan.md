

# Plano: Iniciar Renovação Mensal Apenas Após Bônus de Perfil Completo

## Resumo da Mudança

Atualmente, novos usuários Free recebem 10 créditos imediatamente ao acessar o sistema. A nova lógica será:

```text
┌─────────────────────┐
│   Usuário Novo      │ → 0 créditos (sem nada automático)
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Perfil 100% OK     │ → +10 créditos (bônus único)
│                     │ → Inicia contagem de 30 dias
└─────────┬───────────┘
          │ (30 dias)
          ▼
┌─────────────────────┐
│  Renovação Mensal   │ → +10 créditos a cada 30 dias
└─────────────────────┘
```

---

## Arquivos a Modificar

### 1. Migração SQL - Atualizar `check_and_grant_monthly_credits`

Criar nova migração para modificar a função:

**Mudanças:**
- Verificar se `profile_completion_bonus_claimed = TRUE` antes de conceder créditos
- Se o bônus não foi reivindicado, retornar `{ granted: false, reason: 'PROFILE_NOT_COMPLETE' }`
- Usar a data do bônus como referência para os 30 dias (não mais a data da última transação `monthly_grant`)

```sql
-- Lógica atual (problema):
IF v_last_grant IS NULL THEN
  -- Dá 10 créditos imediatamente para usuário novo ❌
END IF;

-- Nova lógica (corrigida):
-- 1. Verificar se perfil foi completado (bônus claimed)
SELECT profile_completion_bonus_claimed INTO v_bonus_claimed
FROM profiles WHERE user_id = p_user_id;

IF NOT COALESCE(v_bonus_claimed, false) THEN
  RETURN { granted: false, reason: 'PROFILE_NOT_COMPLETE' };
END IF;

-- 2. Usar data do bônus como referência para 30 dias
SELECT created_at INTO v_bonus_date
FROM platform_credit_transactions
WHERE user_id = p_user_id AND action = 'topup' AND description LIKE 'Bônus: Perfil 100%'
ORDER BY created_at DESC LIMIT 1;

-- 3. Calcular dias desde o bônus (não desde último monthly_grant)
```

### 2. Atualizar `grant_profile_completion_bonus`

Adicionar lógica para inserir o primeiro registro de `monthly_grant` referência (sem créditos, apenas para tracking):

**Opcional:** Criar coluna `profiles.renewal_start_at` para guardar a data de início da renovação.

---

## Detalhes Técnicos

### Mudanças na Função `check_and_grant_monthly_credits`

```sql
CREATE OR REPLACE FUNCTION public.check_and_grant_monthly_credits(
  p_user_id uuid,
  p_user_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bonus_claimed BOOLEAN;
  v_bonus_date TIMESTAMP WITH TIME ZONE;
  v_last_grant TIMESTAMP WITH TIME ZONE;
  v_days_since_bonus INTEGER;
  v_plan_type TEXT;
  v_new_plan_balance INTEGER;
  v_new_total INTEGER;
BEGIN
  -- PASSO 1: Verificar se perfil foi completado (bônus reivindicado)
  SELECT profile_completion_bonus_claimed INTO v_bonus_claimed
  FROM profiles WHERE user_id = p_user_id;

  IF NOT COALESCE(v_bonus_claimed, false) THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'PROFILE_NOT_COMPLETE'
    );
  END IF;

  -- PASSO 2: Buscar data do bônus de perfil completo
  SELECT created_at INTO v_bonus_date
  FROM platform_credit_transactions
  WHERE user_id = p_user_id 
    AND user_type = p_user_type
    AND action = 'topup'
    AND description LIKE '%Perfil 100% completo%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_bonus_date IS NULL THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'BONUS_NOT_FOUND'
    );
  END IF;

  -- PASSO 3: Buscar última renovação mensal (se houver)
  SELECT created_at INTO v_last_grant
  FROM platform_credit_transactions
  WHERE user_id = p_user_id 
    AND user_type = p_user_type
    AND action = 'monthly_grant'
  ORDER BY created_at DESC
  LIMIT 1;

  -- PASSO 4: Calcular tempo desde referência
  -- Se nunca recebeu monthly_grant, usar data do bônus
  -- Se já recebeu, usar data do último monthly_grant
  IF v_last_grant IS NOT NULL THEN
    v_days_since_bonus := (CURRENT_DATE - v_last_grant::date);
  ELSE
    v_days_since_bonus := (CURRENT_DATE - v_bonus_date::date);
  END IF;

  IF v_days_since_bonus < 30 THEN
    RETURN jsonb_build_object(
      'granted', false,
      'reason', 'NOT_ENOUGH_TIME',
      'days_remaining', 30 - v_days_since_bonus
    );
  END IF;

  -- PASSO 5: Verificar tipo de plano (só free/standard elegível)
  -- ... (manter lógica existente)

  -- PASSO 6: Conceder créditos
  -- ... (manter lógica existente)
END;
$$;
```

---

## Ordem de Implementação

1. **Criar migração SQL** com a função atualizada
2. **Testar** com usuário novo para confirmar que não recebe créditos automáticos
3. **Testar** fluxo de perfil completo → bônus → 30 dias → renovação

---

## Impacto

| Cenário | Antes | Depois |
|---------|-------|--------|
| Usuário novo acessa sistema | +10 créditos imediato | 0 créditos |
| Perfil completado 100% | +10 bônus | +10 bônus + inicia contagem |
| 30 dias após bônus | +10 renovação | +10 renovação |
| Usuário com perfil incompleto tenta renovar | Recebe créditos | Bloqueado |

