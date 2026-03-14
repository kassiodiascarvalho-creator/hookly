

## Situacao Atual

Este projeto Lovable esta em branco ("Welcome to Your Blank App"), mas o repositorio GitHub `hookly` conectado contem todo o codigo do app original **HOOKLY (03)** — uma plataforma de freelancers com:

- **32 paginas** (Auth, Dashboard, Projects, Messages, Admin, etc.)
- **27+ diretorios de componentes** (landing, admin, analytics, payments, contracts, etc.)
- **35+ hooks customizados**
- **2 contexts** (Auth, Language)
- **40+ Edge Functions** (pagamentos Stripe/MercadoPago, AI, webhooks)
- **57+ migrations SQL**
- **i18n** (internacionalizacao)
- Integracao com **Stripe**, **MercadoPago**, **Supabase**

## Problema

O Lovable nao importa codigo do GitHub — ele apenas **envia** codigo para o GitHub. Como este e um projeto novo conectado ao mesmo repo, o codigo local esta vazio.

## Plano de Sincronizacao

Vou copiar todos os arquivos do projeto original [HOOKLY (03)](/projects/a58dd54c-7e4c-4cbe-945d-415eea42668f) para este projeto usando as ferramentas cross-project. Devido ao tamanho massivo do projeto (centenas de arquivos), isso sera feito em varias etapas:

### Etapa 1 — Configuracao base
- Atualizar `package.json` com todas as dependencias (framer-motion, i18next, stripe, mercadopago, etc.)
- Copiar `index.html`, `tailwind.config.ts`, `vite.config.ts`, `index.css`

### Etapa 2 — Core do app
- Copiar `App.tsx`, contexts (`AuthContext`, `LanguageContext`)
- Copiar `src/lib/` (utils, i18n, formatacao de moeda, etc.)
- Copiar `src/integrations/supabase/` (client e types atualizados)

### Etapa 3 — Hooks
- Copiar todos os 35+ hooks customizados

### Etapa 4 — Componentes compartilhados
- Copiar componentes base (ProtectedRoute, Logo, layouts, etc.)
- Copiar componentes UI customizados

### Etapa 5 — Paginas e componentes de feature
- Copiar todas as 32 paginas
- Copiar todos os 27 diretorios de componentes de feature

### Etapa 6 — Backend (Supabase)
- Copiar Edge Functions
- Copiar migrations

### Nota Importante
- O projeto usa o mesmo Supabase (`vcdpverffffivoxroytr`), entao o banco de dados ja deve estar configurado
- Devido a quantidade massiva de arquivos, este processo levara **multiplas mensagens** para completar
- Cada mensagem tera um limite de arquivos que posso criar

