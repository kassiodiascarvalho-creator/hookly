

# Plano de Hardening de Seguranca no Frontend

## Contexto

Ao inspecionar o codigo no navegador (DevTools), informacoes sensiveis ficam visiveis: URLs de webhooks, chaves de API, logs de debug com dados internos, e o source map completo do codigo-fonte. Este plano aplica boas praticas de seguranca sem quebrar funcionalidades.

## O que sera feito

### 1. Desabilitar Source Maps em producao (vite.config.ts)
Source maps permitem ver o codigo-fonte original no DevTools. Em producao, isso deve ser desativado.

- Adicionar `build: { sourcemap: false }` na configuracao do Vite
- Isso impede que o codigo TypeScript original seja visivel no inspetor

### 2. Remover console.log em producao (vite.config.ts)
Existem mais de 560 chamadas de `console.log` espalhadas pelo codigo. Em producao, esses logs expoe fluxos internos, IDs de pagamento, dados de usuario, etc.

- Configurar `esbuild: { drop: ["console", "debugger"] }` no Vite para builds de producao
- Isso remove automaticamente TODOS os `console.log`, `console.error`, `console.warn` e `debugger` do bundle final
- Nao precisa alterar nenhum arquivo de componente -- o Vite faz a remocao no build

### 3. Remover comentarios do bundle final (vite.config.ts)
Comentarios no codigo podem revelar logica interna, TODOs e informacoes de arquitetura.

- Configurar `esbuild: { legalComments: "none" }` para remover comentarios do bundle

### 4. Proteger informacoes no HTML (index.html)
- Remover o comentario `<!-- TODO: Set the document title -->` e `<!-- TODO: Update og:title -->`  que expoe detalhes de desenvolvimento
- Remover `<meta name="author" content="Lovable" />` que revela a plataforma usada

### 5. Adicionar headers de seguranca via meta tags (index.html)
- Adicionar `<meta http-equiv="X-Content-Type-Options" content="nosniff">`
- Adicionar meta tag de `Content-Security-Policy` restritiva para scripts

## Secao Tecnica

### Arquivo: `vite.config.ts`
```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    minify: "esbuild",
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
    legalComments: "none",
  },
}));
```

### Arquivo: `index.html`
- Remover os 2 comentarios TODO
- Remover `<meta name="author" content="Lovable">`
- Adicionar meta de seguranca

### O que NAO muda
- As chaves `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` sao chaves **publicas** por design (a anon key so permite acesso via RLS). Isso e seguro e esperado
- A chave `VITE_STRIPE_PUBLISHABLE_KEY` (pk_) tambem e publica por design do Stripe
- Nenhum Edge Function sera alterado
- Nenhuma funcionalidade sera quebrada

### Resultado esperado
- Inspetor do navegador nao mostrara o codigo-fonte original
- Console do navegador ficara limpo sem logs de debug
- Comentarios internos nao aparecerrao no bundle
- HTML nao revelara informacoes sobre a plataforma de desenvolvimento

