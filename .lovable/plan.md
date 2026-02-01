

# Plano: Corrigir o Formulário de Perfil do Freelancer e a Foto

## Problema Identificado

O formulário de perfil do freelancer e a foto de perfil não estão carregando na página de Configurações porque há um erro de **recursão infinita** na política de segurança (RLS) da tabela `freelancer_profiles`. 

Os logs do banco de dados mostram repetidamente:
```
"infinite recursion detected in policy for relation 'freelancer_profiles'"
```

**Causa raiz**: A política RLS atual contém uma consulta que referencia a própria tabela `freelancer_profiles` para verificar se o usuário é um freelancer:
```sql
OR EXISTS (
  SELECT 1 FROM freelancer_profiles fp   -- ← ERRADO: referencia a si mesma
  WHERE fp.user_id = auth.uid()
)
```

Isso cria um loop infinito quando o Postgres tenta avaliar a política.

## Solução

Atualizar a política RLS para verificar o tipo de usuário através da tabela `profiles` (que não tem esse problema de recursão):

```sql
-- CORRETO: usa a tabela profiles para verificar o tipo de usuário
OR EXISTS (
  SELECT 1 FROM profiles me
  WHERE me.user_id = auth.uid()
    AND me.user_type = 'freelancer'
)
```

## Passos de Implementação

### 1. Remover/Atualizar a migração problemática
Atualizar a migração `20260201_freelancer_profiles_public_view_security.sql` para corrigir a política, garantindo que a versão correta seja aplicada.

### 2. Garantir a política correta no banco
A migração deve:
- Remover a política existente (que está com bug)
- Criar a política correta que NÃO referencia `freelancer_profiles` dentro de si mesma

### Detalhes Técnicos

A política corrigida ficará assim:

```sql
DROP POLICY IF EXISTS "Users can view freelancer profiles with context" ON public.freelancer_profiles;

CREATE POLICY "Users can view freelancer profiles with context"
ON public.freelancer_profiles FOR SELECT
USING (
  -- Próprio perfil
  auth.uid() = user_id
  -- Admin
  OR is_admin()
  -- Empresas com propostas aceitas deste freelancer
  OR EXISTS (
    SELECT 1 FROM proposals p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.freelancer_user_id = freelancer_profiles.user_id
      AND pr.company_user_id = auth.uid()
      AND p.status = 'accepted'
  )
  -- Freelancers podem ver outros freelancers (talent pool)
  -- USANDO tabela profiles para evitar recursão
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'freelancer'
  )
  -- Empresas podem ver freelancers (para contratação)
  -- USANDO tabela profiles para evitar recursão
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'company'
  )
);
```

## Resultado Esperado

Após aplicar a correção:
- O formulário de perfil do freelancer voltará a aparecer na página de Configurações
- A foto de perfil (avatar) será exibida corretamente
- O freelancer poderá editar todos os campos do seu perfil normalmente
- Não haverá mais erros 500 ao acessar `/settings`

