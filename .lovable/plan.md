

# Plano de Rastreabilidade Avançada para Conversão

## Visão Geral

Com o Analytics básico já implementado (pageviews, sessões, bounce rate, etc.), este plano propõe **4 camadas adicionais de rastreabilidade** que vão revelar exatamente onde os usuários desistem e o que tentam fazer, permitindo otimizações precisas para aumentar conversões.

---

## 1. Event Tracking (Rastreamento de Eventos)

### O que é
Rastrear **ações específicas** dos usuários (não apenas pageviews), como cliques em botões, interações com formulários e engajamento com seções.

### Eventos críticos a rastrear na Landing Page

| Evento | Descrição | Insight Obtido |
|--------|-----------|----------------|
| `cta_click` | Clique nos botões "Começar Agora", "Ver Talentos" | Qual CTA converte mais |
| `signup_modal_open` | Modal de cadastro aberto | Interesse vs conversão real |
| `signup_type_select` | Usuário escolheu "Empresa" ou "Freelancer" | Perfil do público |
| `nav_link_click` | Clique nos links do menu | Interesse por seção |
| `faq_expand` | FAQ item expandido | Dúvidas mais comuns |
| `scroll_depth` | Profundidade de scroll (25%, 50%, 75%, 100%) | Até onde leem |
| `category_click` | Clique em categoria de serviços | Categorias mais buscadas |
| `pricing_view` | Seção de preços visualizada | Interesse comercial |
| `testimonial_view` | Tempo na seção de depoimentos | Validação social funciona? |

### Implementação
- Nova tabela `analytics_events` com campos: `session_id`, `event_name`, `event_data` (JSON), `page_path`, `element_id`
- Hook `useEventTracker()` para disparar eventos facilmente
- Componente wrapper para elementos clicáveis

---

## 2. Session Replay (Gravação de Sessões)

### O que é
**Gravação visual** das sessões dos usuários para assistir exatamente o que fizeram, onde hesitaram e onde desistiram.

### Como funciona
- Captura movimentos do mouse, cliques, scrolls e interações
- Gera uma "reprodução" da sessão que pode ser assistida
- Filtrável por: páginas visitadas, duração, bounce, dispositivo

### Casos de uso
- Ver por que usuários abandonam na página de signup
- Identificar elementos confusos ou que geram hesitação
- Detectar bugs de UI que impedem conversão
- Entender comportamento em mobile vs desktop

### Implementação
- Usar biblioteca `rrweb` para captura leve
- Armazenar gravações comprimidas no Storage
- Dashboard para assistir replays filtrados por critérios

---

## 3. Heatmaps (Mapas de Calor)

### O que é
Visualização agregada de **onde os usuários clicam**, até **onde scrollam** e **onde passam o mouse**.

### Tipos de Heatmaps

```text
┌────────────────────────────────────────┐
│           CLICK HEATMAP                │
│  ┌──────────────────────────────────┐  │
│  │  ████ CTA Principal (45%)        │  │
│  │  ██   CTA Secundário (12%)       │  │
│  │  █    Menu Links (8%)            │  │
│  │  ███  Categorias (23%)           │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│           SCROLL HEATMAP               │
│  Hero         ████████████ 100%        │
│  Categorias   █████████    78%         │
│  Como Funciona ███████     62%         │
│  Comparação   █████        45%         │
│  Preços       ████         38%         │
│  Testimonials ███          28%         │
│  FAQ          ██           18%         │
│  CTA Final    █            12%         │
└────────────────────────────────────────┘
```

### Insights obtidos
- **Click Heatmap**: Quais elementos atraem atenção
- **Scroll Heatmap**: Até onde os usuários leem (se não chegam ao CTA final, ele precisa subir)
- **Áreas mortas**: Partes da página que ninguém interage

### Implementação
- Tabela `analytics_interactions` para gravar posição de cliques
- Evento de scroll com percentuais atingidos
- Visualização agregada no dashboard admin

---

## 4. Funnel Analysis (Análise de Funil)

### O que é
Rastrear o **fluxo de conversão** passo-a-passo para identificar exatamente onde os usuários abandonam.

### Funil Principal: Landing → Cadastro

```text
                          ┌─────────────────┐
     100% (500 visits) ─→ │  Landing Page   │
                          └────────┬────────┘
                                   │ -35%
                          ┌────────▼────────┐
      65% (325 users) ─→  │  Scroll > 50%   │
                          └────────┬────────┘
                                   │ -25%
                          ┌────────▼────────┐
      40% (200 users) ─→  │  Click CTA      │
                          └────────┬────────┘
                                   │ -15%
                          ┌────────▼────────┐
      25% (125 users) ─→  │  Auth Page      │
                          └────────┬────────┘
                                   │ -10%
                          ┌────────▼────────┐
      15% (75 users)  ─→  │  Start Signup   │
                          └────────┬────────┘
                                   │ -8%
                          ┌────────▼────────┐
       7% (35 users)  ─→  │  Complete       │
                          └─────────────────┘
```

### Implementação
- Eventos marcadores em cada etapa do funil
- Cálculo automático de taxas de conversão entre etapas
- Visualização no dashboard com gráfico de funil
- Comparação por período e segmentação (device, source, country)

---

## Dashboard Unificado

### Novas Seções no Admin Analytics

1. **Eventos em Tempo Real**
   - Feed ao vivo de eventos acontecendo
   - Contadores por tipo de evento

2. **Heatmap por Página**
   - Seletor de página
   - Overlay visual de cliques e scroll

3. **Session Replays**
   - Lista de sessões gravadas
   - Player para assistir
   - Filtros: bounce, duração, página de saída

4. **Funil de Conversão**
   - Gráfico visual do funil
   - % de conversão em cada etapa
   - Comparativo por período

5. **Insights Automáticos**
   - "45% dos usuários não scrollam até a seção de Preços"
   - "O CTA 'Ver Talentos' tem 3x mais cliques que 'Começar Agora'"
   - "Mobile tem 60% mais bounce que Desktop"

---

## Ordem de Implementação Recomendada

| Fase | Feature | Impacto | Complexidade |
|------|---------|---------|--------------|
| 1 | Event Tracking | Alto | Baixa |
| 2 | Scroll Depth Tracking | Alto | Baixa |
| 3 | Funnel Analysis | Alto | Média |
| 4 | Heatmaps | Médio | Média |
| 5 | Session Replay | Alto | Alta |

**Recomendação**: Começar com **Event Tracking + Scroll Depth** na Fase 1 (maior impacto com menor esforço), depois evoluir para Funnel Analysis e finalmente Session Replays.

---

## Seção Técnica

### Estrutura de Banco de Dados

```sql
-- Tabela de eventos
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_path TEXT,
  element_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de interações (para heatmaps)
CREATE TABLE analytics_interactions (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  interaction_type TEXT, -- 'click', 'scroll', 'hover'
  page_path TEXT,
  x_position INT,
  y_position INT,
  scroll_depth INT,
  viewport_width INT,
  viewport_height INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de sessões gravadas
CREATE TABLE analytics_session_recordings (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  recording_data JSONB, -- rrweb events comprimidos
  duration_seconds INT,
  page_count INT,
  is_bounce BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Hooks a Criar

- `useEventTracker()` - Dispara eventos customizados
- `useScrollTracker()` - Monitora profundidade de scroll
- `useClickTracker()` - Captura posições de cliques
- `useSessionRecorder()` - Integração com rrweb

### Componentes

- `<TrackedButton>` - Botão que dispara evento automaticamente
- `<TrackedLink>` - Link com tracking integrado
- `<ScrollObserver>` - Observa quando seções entram na viewport

