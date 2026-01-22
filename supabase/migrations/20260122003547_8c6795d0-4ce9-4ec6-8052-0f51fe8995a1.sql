-- Create company_plans table for subscription tracking
CREATE TABLE public.company_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_user_id UUID NOT NULL UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'pro', 'elite')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  projects_this_month INTEGER DEFAULT 0,
  projects_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own company plan"
  ON public.company_plans FOR SELECT
  USING (company_user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert company plans"
  ON public.company_plans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update company plans"
  ON public.company_plans FOR UPDATE
  USING (true);

-- Index for faster lookups
CREATE INDEX idx_company_plans_user_id ON public.company_plans(company_user_id);
CREATE INDEX idx_company_plans_stripe_sub ON public.company_plans(stripe_subscription_id);

-- Function to check plan limits
CREATE OR REPLACE FUNCTION public.check_company_plan_limit(p_company_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan company_plans%ROWTYPE;
  v_limit INTEGER;
BEGIN
  SELECT * INTO v_plan FROM company_plans WHERE company_user_id = p_company_user_id;
  
  -- If no plan exists, treat as free (unlimited but basic)
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'plan_type', 'free', 'projects_used', 0, 'projects_limit', null);
  END IF;
  
  -- Reset counter if new month
  IF v_plan.projects_reset_at < date_trunc('month', now()) THEN
    UPDATE company_plans 
    SET projects_this_month = 0, projects_reset_at = now(), updated_at = now()
    WHERE id = v_plan.id;
    v_plan.projects_this_month := 0;
  END IF;
  
  -- Determine limit based on plan
  v_limit := CASE v_plan.plan_type
    WHEN 'starter' THEN 5
    WHEN 'pro' THEN NULL -- unlimited
    WHEN 'elite' THEN NULL -- unlimited
    ELSE NULL -- free has no limit for now
  END;
  
  RETURN jsonb_build_object(
    'allowed', v_limit IS NULL OR v_plan.projects_this_month < v_limit,
    'plan_type', v_plan.plan_type,
    'projects_used', v_plan.projects_this_month,
    'projects_limit', v_limit,
    'status', v_plan.status
  );
END;
$$;

-- Function to increment project count
CREATE OR REPLACE FUNCTION public.increment_company_project_count(p_company_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE company_plans 
  SET projects_this_month = projects_this_month + 1, updated_at = now()
  WHERE company_user_id = p_company_user_id;
  
  RETURN TRUE;
END;
$$;