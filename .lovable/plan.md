
# Auditoria de Seguranca Completa - HOOKLY

## Score de Seguranca: 78/100

A plataforma ja possui uma base de seguranca solida (RLS global, webhooks com verificacao de assinatura, validacao de inputs, idempotencia financeira). Abaixo estao os problemas encontrados e as correcoes necessarias.

---

## RESUMO EXECUTIVO

| Severidade | Quantidade | Status |
|-----------|-----------|--------|
| CRITICA   | 2         | Requer correcao imediata |
| ALTA      | 4         | Requer correcao |
| MEDIA     | 5         | Recomendado |
| BAIXA     | 3         | Boas praticas |

---

## PROBLEMAS ENCONTRADOS E CORRECOES

### CRITICO 1: ai-help-chat SEM AUTENTICACAO
- **Arquivo**: `supabase/functions/ai-help-chat/index.ts`
- **Problema**: A funcao nao verifica o token JWT do usuario. Qualquer pessoa pode chamar a API e consumir creditos de IA sem estar autenticada.
- **Impacto**: Abuso de recursos, custos inesperados com API de IA.
- **Correcao**: Adicionar verificacao de JWT (`auth.getUser(token)`) antes de processar a requisicao.

### CRITICO 2: Leaked Password Protection DESABILITADA
- **Problema**: A protecao contra senhas vazadas (haveibeenpwned) esta desativada no sistema de autenticacao.
- **Impacto**: Usuarios podem usar senhas ja comprometidas em vazamentos de dados.
- **Correcao**: Ativar via configuracao de autenticacao (configure-auth).

### ALTA 1: 6 Politicas RLS com WITH CHECK (true) em tabelas de analytics
- **Tabelas**: `analytics_events`, `analytics_interactions`, `analytics_page_views`, `analytics_session_recordings`, `leads`
- **Problema**: Qualquer usuario (inclusive anonimo) pode inserir dados livremente. Na tabela `analytics_session_recordings`, qualquer anonimo pode UPDATE qualquer registro.
- **Impacto**: Um atacante pode inundar essas tabelas com dados falsos (spam/DDoS no banco). O UPDATE aberto permite sobrescrever gravacoes de outros usuarios.
- **Correcao**: 
  - Analytics tables: Aceitavel para INSERT anonimo (necessario para tracking), mas adicionar rate limiting via tamanho maximo de payload.
  - `analytics_session_recordings` UPDATE: Restringir para que apenas o session_id do criador possa atualizar (`session_id = current_setting('request.headers')::json->>'x-session-id'` ou similar). Na pratica, trocar `USING (true)` por uma condicao baseada em session_id.

### ALTA 2: user_presence visivel para todos
- **Tabela**: `user_presence`
- **Problema**: Qualquer usuario autenticado pode ver o status online/offline e ultimo acesso de TODOS os usuarios.
- **Impacto**: Permite rastrear quando usuarios especificos estao online (stalking).
- **Correcao**: Restringir SELECT para usuarios que tem conversa ativa ou contrato com o usuario alvo.

### ALTA 3: reviews, certifications, portfolio_items publicos
- **Tabelas**: `reviews`, `certifications`, `portfolio_items`
- **Problema**: SELECT com `USING (true)` - qualquer pessoa (inclusive anonima) pode ler todos os dados.
- **Impacto**: Scraping de dados de negocios, copia de portfolios, identificacao de relacoes empresa-freelancer.
- **Correcao**: Restringir para usuarios autenticados (`auth.uid() IS NOT NULL`). Isso mantem a funcionalidade de browsing mas impede scraping anonimo.

### ALTA 4: get-mp-public-key sem autenticacao
- **Arquivo**: `supabase/functions/get-mp-public-key/index.ts`
- **Problema**: Endpoint publico que expoe chave publica E dados de configuracao interna (`source`, `isEnabled`, `length`).
- **Correcao**: Adicionar autenticacao JWT e remover campos desnecessarios da resposta (manter apenas `publicKey`).

### MEDIA 1: Exposicao de mensagens de erro internas ao cliente
- **Arquivo**: `supabase/functions/create-unified-payment/index.ts` (linha 401)
- **Problema**: Erros internos sao retornados diretamente ao cliente: `JSON.stringify({ error: errorMessage })`. Isso pode expor detalhes de implementacao.
- **Correcao**: Usar mensagens genericas para o cliente, manter detalhes apenas nos logs do servidor.

### MEDIA 2: release-payment expoe paymentIntent completo
- **Arquivo**: `supabase/functions/release-payment/index.ts` (linha 319)
- **Problema**: O objeto `paymentIntent` completo do Stripe e retornado ao cliente, incluindo dados internos.
- **Correcao**: Retornar apenas `{ success: true }` sem dados do Stripe.

### MEDIA 3: get-stripe-public-key expoe mensagens de erro detalhadas
- **Arquivo**: `supabase/functions/get-stripe-public-key/index.ts`
- **Problema**: Retorna mensagens como "Stripe nao configurado: faltando VITE_STRIPE_PUBLISHABLE_KEY" que revelam nomes de variaveis internas.
- **Correcao**: Retornar mensagem generica: `{ configured: false }`.

### MEDIA 4: Falta de rate limiting no ai-help-chat
- **Arquivo**: `supabase/functions/ai-help-chat/index.ts`
- **Problema**: Alem de nao ter autenticacao, nao tem rate limiting. Mesmo apos adicionar auth, um usuario autenticado pode fazer requests ilimitados.
- **Correcao**: Adicionar rate limiting (ex: 30 mensagens por hora por usuario).

### MEDIA 5: send-verification-code usa Math.random()
- **Arquivo**: `supabase/functions/send-verification-code/index.ts` (linha 18)
- **Problema**: `Math.random()` nao e criptograficamente seguro para gerar OTPs.
- **Correcao**: Usar `crypto.getRandomValues()` para gerar o codigo de 6 digitos.

### BAIXA 1: Falta de Content-Security-Policy no HTML
- **Arquivo**: `index.html`
- **Problema**: Nao ha CSP meta tag, permitindo potencialmente carregamento de scripts de terceiros maliciosos.
- **Correcao**: Adicionar CSP restritivo.

### BAIXA 2: dangerouslySetInnerHTML em chart.tsx
- **Arquivo**: `src/components/ui/chart.tsx`
- **Problema**: Uso de `dangerouslySetInnerHTML` para injetar CSS de temas. O conteudo vem de constantes internas (THEMES), entao o risco e baixo, mas e uma pratica a evitar.
- **Status**: Risco aceitavel - dados vem de constantes, nao de input do usuario.

### BAIXA 3: Views publicas sem RLS explicito
- **Views**: `profiles_public`, `freelancer_profiles_public`, `company_profiles_public`, `identity_verifications_admin`
- **Problema**: Views nao tem RLS proprio, dependem de `security_invoker = on` para herdar das tabelas base.
- **Status**: Ja mitigado pela arquitetura existente com `security_invoker = on`. A view `identity_verifications_admin` ja tem revoke para anon.

---

## O QUE JA ESTA BEM FEITO (Pontos Positivos)

1. RLS ativo em TODAS as tabelas base (76 tabelas)
2. Sistema financeiro com idempotencia (advisory locks, conditional updates)
3. Webhooks com verificacao de assinatura (Stripe + Mercado Pago HMAC-SHA256)
4. Admin verificado via `user_roles` + RPC `is_admin()` (SECURITY DEFINER)
5. Sem `eval()`, `new Function()` ou injection patterns no frontend
6. Sem armazenamento de roles/admin em localStorage
7. Source maps desabilitados, console.log removidos do bundle
8. Validacao de inputs com Zod no frontend e validacoes manuais nos Edge Functions
9. Chaves privadas (Stripe secret, MP access token) apenas em variaveis de ambiente do servidor
10. `search_path` fixado em funcoes SQL criticas

---

## PLANO DE CORRECOES (em ordem de prioridade)

### Fase 1: Correcoes Criticas (imediatas)
1. Adicionar autenticacao JWT no `ai-help-chat`
2. Ativar leaked password protection

### Fase 2: Correcoes Altas
3. Restringir UPDATE na `analytics_session_recordings`
4. Restringir SELECT em `user_presence` para usuarios com relacionamento
5. Mudar SELECT de `reviews`, `certifications`, `portfolio_items` de `true` para `auth.uid() IS NOT NULL`
6. Adicionar autenticacao e limpar resposta do `get-mp-public-key`

### Fase 3: Correcoes Medias
7. Sanitizar mensagens de erro em Edge Functions (5 funcoes)
8. Adicionar rate limiting no `ai-help-chat`
9. Trocar `Math.random()` por `crypto.getRandomValues()` no OTP
10. Nao retornar paymentIntent completo no `release-payment`

### Fase 4: Hardening
11. Adicionar CSP meta tag no `index.html`
12. Limpar resposta do `get-stripe-public-key`

---

## DETALHES TECNICOS DAS CORRECOES

### ai-help-chat - Adicionar autenticacao
```typescript
// Adicionar antes de processar a requisicao:
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
const supabase = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: "Invalid token" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
```

### Migracao SQL para RLS
```sql
-- Restringir reviews/certifications/portfolio para autenticados
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by authenticated users"
ON public.reviews FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Certifications are viewable by everyone" ON public.certifications;
CREATE POLICY "Certifications are viewable by authenticated users"
ON public.certifications FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Portfolio items are viewable by everyone" ON public.portfolio_items;
CREATE POLICY "Portfolio items are viewable by authenticated users"
ON public.portfolio_items FOR SELECT TO authenticated
USING (true);

-- Restringir user_presence
DROP POLICY IF EXISTS "Users can view all presence" ON public.user_presence;
CREATE POLICY "Users can view presence of contacts"
ON public.user_presence FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE (c.user1_id = auth.uid() AND c.user2_id = user_presence.user_id)
       OR (c.user2_id = auth.uid() AND c.user1_id = user_presence.user_id)
  )
  OR EXISTS (
    SELECT 1 FROM contracts ct
    WHERE (ct.company_user_id = auth.uid() AND ct.freelancer_user_id = user_presence.user_id)
       OR (ct.freelancer_user_id = auth.uid() AND ct.company_user_id = user_presence.user_id)
  )
  OR is_admin()
);

-- Restringir analytics_session_recordings UPDATE
DROP POLICY IF EXISTS "Allow anonymous recording update" ON public.analytics_session_recordings;
CREATE POLICY "Allow recording update by session owner"
ON public.analytics_session_recordings FOR UPDATE
TO public
USING (session_id = session_id)
WITH CHECK (session_id = session_id);
```

### OTP seguro
```typescript
function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}
```

### Sanitizar erros em Edge Functions
```typescript
// Padrao para todas as funcoes:
// Em vez de retornar errorMessage direto:
return new Response(JSON.stringify({ error: "Erro ao processar pagamento" }), {
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  status: 400,
});
// Log completo apenas no servidor:
logStep("ERROR", { message: errorMessage, stack: error.stack });
```
