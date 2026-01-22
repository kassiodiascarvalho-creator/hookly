
-- Create freelancer plan definitions table (similar to company_plan_definitions)
CREATE TABLE public.freelancer_plan_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_usd_cents INTEGER NOT NULL DEFAULT 0,
  stripe_price_id TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  proposals_limit INTEGER, -- null = unlimited
  highlight_proposals BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  verified_badge BOOLEAN NOT NULL DEFAULT false,
  popular BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create freelancer plans table (subscriptions)
CREATE TABLE public.freelancer_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_user_id UUID NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  proposals_this_month INTEGER DEFAULT 0,
  proposals_reset_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.freelancer_plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies for freelancer_plan_definitions (public read, admin write)
CREATE POLICY "Anyone can view active freelancer plan definitions"
ON public.freelancer_plan_definitions FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage freelancer plan definitions"
ON public.freelancer_plan_definitions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS policies for freelancer_plans
CREATE POLICY "Users can view their own freelancer plan"
ON public.freelancer_plans FOR SELECT
USING (freelancer_user_id = auth.uid());

CREATE POLICY "Users can insert their own freelancer plan"
ON public.freelancer_plans FOR INSERT
WITH CHECK (freelancer_user_id = auth.uid());

CREATE POLICY "Users can update their own freelancer plan"
ON public.freelancer_plans FOR UPDATE
USING (freelancer_user_id = auth.uid());

CREATE POLICY "Admins can manage all freelancer plans"
ON public.freelancer_plans FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default freelancer plans (lower prices than company plans)
INSERT INTO public.freelancer_plan_definitions (plan_type, name, description, price_usd_cents, features, proposals_limit, highlight_proposals, priority_support, verified_badge, popular, display_order, is_active) VALUES
('free', 'Grátis', 'Comece sem custos', 0, '["5 propostas por mês", "Perfil básico", "Acesso ao marketplace"]', 5, false, false, false, false, 0, true),
('starter', 'Freelancer Starter', 'Para freelancers em crescimento', 990, '["20 propostas por mês", "Destaque em propostas", "Estatísticas básicas"]', 20, true, false, false, false, 1, true),
('pro', 'Freelancer Pro', 'Maximize suas oportunidades', 1990, '["Propostas ilimitadas", "Destaque em propostas", "Suporte prioritário", "Badge verificado"]', null, true, true, true, true, 2, true),
('elite', 'Freelancer Elite', 'O melhor para profissionais top', 3990, '["Propostas ilimitadas", "Destaque em propostas", "Suporte prioritário", "Badge verificado", "Posição no topo das buscas"]', null, true, true, true, false, 3, true);

-- Create trigger for updated_at
CREATE TRIGGER update_freelancer_plan_definitions_updated_at
BEFORE UPDATE ON public.freelancer_plan_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_freelancer_plans_updated_at
BEFORE UPDATE ON public.freelancer_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
