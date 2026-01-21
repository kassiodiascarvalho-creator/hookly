-- Add boosted_until column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of boosted projects
CREATE INDEX IF NOT EXISTS idx_projects_boosted_until 
ON public.projects(boosted_until) 
WHERE boosted_until IS NOT NULL;

-- Create project_actions_log table for audit trail
CREATE TABLE IF NOT EXISTS public.project_actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  credits_used INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on project_actions_log
ALTER TABLE public.project_actions_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own project action logs
CREATE POLICY "Users can view own project action logs"
ON public.project_actions_log
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own project action logs
CREATE POLICY "Users can insert own project action logs"
ON public.project_actions_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all project action logs
CREATE POLICY "Admins can view all project action logs"
ON public.project_actions_log
FOR SELECT
USING (public.is_admin());

-- Create index for efficient project lookups in action log
CREATE INDEX IF NOT EXISTS idx_project_actions_log_project_id 
ON public.project_actions_log(project_id);

CREATE INDEX IF NOT EXISTS idx_project_actions_log_user_id 
ON public.project_actions_log(user_id);

-- Insert boost_project action into platform_action_costs
INSERT INTO public.platform_action_costs (action_key, cost_credits, display_name, description, is_enabled)
VALUES ('boost_project', 10, 'Destacar Projeto', 'Destaque seu projeto no topo da listagem por 7 dias', true)
ON CONFLICT (action_key) DO UPDATE SET
  cost_credits = 10,
  display_name = 'Destacar Projeto',
  description = 'Destaque seu projeto no topo da listagem por 7 dias',
  is_enabled = true;