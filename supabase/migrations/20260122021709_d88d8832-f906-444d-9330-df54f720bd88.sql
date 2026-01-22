-- Tabela para controlar acesso temporário ao Hookly Genius
CREATE TABLE public.genius_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('freelancer', 'company')),
  feature_type TEXT NOT NULL CHECK (feature_type IN ('proposal_ai', 'ranking_ai')),
  access_source TEXT NOT NULL CHECK (access_source IN ('plan', 'credits')),
  credits_spent INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas
CREATE INDEX idx_genius_access_user ON public.genius_access(user_id, feature_type);
CREATE INDEX idx_genius_access_expires ON public.genius_access(expires_at);

-- Enable RLS
ALTER TABLE public.genius_access ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own genius access"
  ON public.genius_access FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert genius access"
  ON public.genius_access FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update genius access"
  ON public.genius_access FOR UPDATE
  USING (true);

-- Tabela para log de uso do Genius
CREATE TABLE public.genius_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('freelancer', 'company')),
  feature_type TEXT NOT NULL CHECK (feature_type IN ('proposal_ai', 'ranking_ai')),
  project_id UUID REFERENCES public.projects(id),
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  model_used TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genius_usage_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own genius usage"
  ON public.genius_usage_log FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert genius usage"
  ON public.genius_usage_log FOR INSERT
  WITH CHECK (true);

-- Adicionar custos do Genius na tabela de action costs
INSERT INTO public.platform_action_costs (action_key, display_name, description, cost_credits, is_enabled)
VALUES 
  ('genius_2days', 'Hookly Genius - 2 dias', 'Acesso ao Hookly Genius por 2 dias', 5, true),
  ('genius_5days', 'Hookly Genius - 5 dias', 'Acesso ao Hookly Genius por 5 dias', 10, true)
ON CONFLICT DO NOTHING;