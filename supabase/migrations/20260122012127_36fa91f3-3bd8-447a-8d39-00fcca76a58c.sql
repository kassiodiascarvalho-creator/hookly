-- Create table for dynamic company plan definitions
CREATE TABLE public.company_plan_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_usd_cents INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  projects_limit INTEGER,
  highlight_proposals BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  dedicated_manager BOOLEAN NOT NULL DEFAULT false,
  popular BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_plan_definitions ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can read active plans"
  ON public.company_plan_definitions
  FOR SELECT
  USING (is_active = true);

-- Only admins can manage plans
CREATE POLICY "Admins can manage plans"
  ON public.company_plan_definitions
  FOR ALL
  USING (public.is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_company_plan_definitions_updated_at
  BEFORE UPDATE ON public.company_plan_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans (prices in USD cents)
INSERT INTO public.company_plan_definitions (plan_type, name, description, price_usd_cents, projects_limit, highlight_proposals, priority_support, dedicated_manager, popular, display_order, features) VALUES
  ('free', 'Grátis', 'Plano gratuito', 0, NULL, false, false, false, false, 0, '["Publicar projetos básicos", "Receber propostas", "Pagamento protegido (escrow)"]'::jsonb),
  ('starter', 'Business Starter', 'Ideal para pequenas empresas', 2900, 5, true, false, false, false, 1, '["Até 5 projetos/mês", "Propostas em destaque", "Suporte prioritário por email", "Relatórios básicos"]'::jsonb),
  ('pro', 'Business Pro', 'Para empresas em crescimento', 5900, NULL, true, true, false, true, 2, '["Projetos ilimitados", "Destaque automático", "Suporte prioritário", "Acesso ao pool de talentos", "Relatórios avançados"]'::jsonb),
  ('elite', 'Business Elite', 'Solução enterprise completa', 9900, NULL, true, true, true, false, 3, '["Tudo do Pro", "Gerente dedicado", "SLA garantido", "API personalizada", "Onboarding assistido"]'::jsonb);