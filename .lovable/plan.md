

# Plano: Corrigir Sistema de Pixels de Rastreamento

## Problema Identificado

A tabela `tracking_pixels` **não existe** no banco de dados. A migração foi criada mas nunca foi aplicada. Isso significa que:
- Você não consegue salvar nenhum pixel (Facebook, Google Analytics, GTM)
- O loader não consegue carregar e injetar os scripts

## Solução

Executar a migração SQL para criar a tabela e as políticas de segurança.

## O Que Será Criado

### 1. Tabela `tracking_pixels`
```text
+--------------------+------------------------------------------+
| Coluna             | Descrição                                |
+--------------------+------------------------------------------+
| id                 | UUID único                               |
| pixel_type         | facebook_pixel / google_analytics / gtm  |
| pixel_id           | ID do pixel (ex: G-XXXXXXXXXX)           |
| is_active          | Se o pixel está ativo                    |
| created_at         | Data de criação                          |
| updated_at         | Data de atualização                      |
+--------------------+------------------------------------------+
```

### 2. Políticas de Segurança (RLS)
- Administradores podem criar/editar/excluir pixels
- Qualquer usuário pode ler pixels ativos (para injeção no frontend)

### 3. Validação dos IDs
| Tipo | Formato Esperado | Exemplo |
|------|------------------|---------|
| Facebook Pixel | Números (15-16 dígitos) | 1234567890123456 |
| Google Analytics 4 | G-XXXXXXXXXX | G-ABC123DEF4 |
| Google Tag Manager | GTM-XXXXXXX | GTM-ABCDEF1 |

## Detalhes Técnicos

```sql
CREATE TABLE public.tracking_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_type text NOT NULL CHECK (pixel_type IN ('facebook_pixel', 'google_analytics', 'google_tag_manager')),
  pixel_id text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pixel_type)
);

ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tracking pixels"
  ON public.tracking_pixels FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Anyone can read active pixels"
  ON public.tracking_pixels FOR SELECT TO anon, authenticated
  USING (is_active = true);
```

## Após Implementação

- Você poderá salvar IDs de Facebook Pixel, Google Analytics e GTM
- Os pixels ativos serão automaticamente injetados em todas as páginas
- O Facebook Pixel rastreará `PageView` automaticamente
- O Google Analytics rastreará pageviews e eventos
- O GTM permitirá configuração avançada via painel Google

