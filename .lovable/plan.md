
# Plano: Corrigir Bug de Arredondamento na Contraproposta

## Problema Identificado

Quando o freelancer envia uma contraproposta com múltiplos milestones, o valor final pode ser **+1 ou -1** do valor digitado devido a erros de arredondamento acumulados.

### Causa Técnica

No arquivo `FreelancerCounterproposalResponseModal.tsx` (linha 136):

```typescript
const proportion = m.amount / totalProposed;
return { ...m, amount: Math.round(proposedValue * proportion) };
```

Cada milestone é arredondado individualmente, e a **soma dos arredondamentos não é garantidamente igual ao valor original**.

---

## Solução

Usar o algoritmo **"Largest Remainder Method"** (Método do Maior Resto), que garante que a soma seja exatamente igual ao valor desejado:

1. Calcular valores proporcionais sem arredondamento
2. Arredondar para baixo todos os valores
3. Distribuir a diferença restante para os milestones com maiores partes fracionárias

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/proposals/FreelancerCounterproposalResponseModal.tsx` | Substituir lógica de distribuição proporcional por algoritmo sem erro |

---

## Seção Técnica

### Código Atual (QUEBRADO)

```typescript
const updatedMilestones = milestones.length > 0
  ? milestones.map((m, index) => {
      if (milestones.length === 1) {
        return { ...m, amount: proposedValue };
      }
      // Distribute proportionally for multiple milestones
      const proportion = m.amount / totalProposed;
      return { ...m, amount: Math.round(proposedValue * proportion) };
    })
  : [{ title: "Milestone 1", amount: proposedValue }];
```

### Código Corrigido (Largest Remainder Method)

```typescript
// Distribute new amount proportionally WITHOUT rounding errors
let updatedMilestones: Milestone[];

if (milestones.length === 0) {
  updatedMilestones = [{ title: "Milestone 1", amount: proposedValue }];
} else if (milestones.length === 1) {
  updatedMilestones = [{ ...milestones[0], amount: proposedValue }];
} else {
  // Largest Remainder Method to distribute without rounding errors
  const proportionalAmounts = milestones.map((m) => ({
    milestone: m,
    exactValue: (m.amount / totalProposed) * proposedValue,
    floorValue: Math.floor((m.amount / totalProposed) * proposedValue),
    remainder: ((m.amount / totalProposed) * proposedValue) % 1,
  }));

  // Sum of floor values
  const floorSum = proportionalAmounts.reduce((sum, p) => sum + p.floorValue, 0);
  
  // How many units to distribute to reach exact total
  const remainder = Math.round(proposedValue) - floorSum;

  // Sort by remainder descending to give extra units to those with highest fractional parts
  const sorted = [...proportionalAmounts].sort((a, b) => b.remainder - a.remainder);

  // Assign floor values, then add 1 to top 'remainder' items
  updatedMilestones = milestones.map((m) => {
    const idx = sorted.findIndex((s) => s.milestone === m);
    const baseAmount = proportionalAmounts.find((p) => p.milestone === m)!.floorValue;
    const extra = idx < remainder ? 1 : 0;
    return { ...m, amount: baseAmount + extra };
  });
}
```

---

## Resultado Esperado

| Cenário | Antes (Bugado) | Depois (Corrigido) |
|---------|----------------|-------------------|
| R$ 1000 com 3 milestones iguais | 333 + 334 + 334 = **1001** ❌ | 333 + 333 + 334 = **1000** ✅ |
| R$ 500 com 2 milestones (60/40) | 300 + 201 = **501** ❌ | 300 + 200 = **500** ✅ |
| R$ 1000 com 1 milestone | 1000 ✅ | 1000 ✅ |

---

## Verificação Adicional

Verificar se o mesmo bug existe em outros lugares do código:
- `ProjectView.tsx` (criação inicial de proposta) - precisa verificar
- `CounterproposalResponseModal.tsx` (empresa) - **NÃO tem o problema** (não recalcula milestones)

---

## Resumo

1. Substituir `Math.round()` individual por algoritmo de distribuição sem erro (Largest Remainder)
2. Garantir que a soma dos milestones seja **exatamente igual** ao valor digitado pelo freelancer
3. Manter compatibilidade com milestones únicos (caso trivial)
