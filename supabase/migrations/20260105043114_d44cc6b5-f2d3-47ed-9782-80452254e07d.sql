-- 1) Add currency column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';

-- 2) Add preferred_payout_currency to freelancer_profiles
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS preferred_payout_currency TEXT DEFAULT 'USD';

-- 3) Create project_invites table for company -> freelancer invitations
CREATE TABLE IF NOT EXISTS public.project_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_user_id UUID NOT NULL,
  freelancer_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on project_invites
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_invites
-- Companies can view their sent invites
CREATE POLICY "Companies can view their sent invites" 
ON public.project_invites 
FOR SELECT 
USING (company_user_id = auth.uid());

-- Freelancers can view their received invites
CREATE POLICY "Freelancers can view their received invites" 
ON public.project_invites 
FOR SELECT 
USING (freelancer_user_id = auth.uid());

-- Admins can view all invites
CREATE POLICY "Admins can view all invites" 
ON public.project_invites 
FOR SELECT 
USING (is_admin());

-- Companies can insert invites for their projects
CREATE POLICY "Companies can insert invites" 
ON public.project_invites 
FOR INSERT 
WITH CHECK (
  auth.uid() = company_user_id AND 
  EXISTS (SELECT 1 FROM projects WHERE id = project_id AND company_user_id = auth.uid())
);

-- Freelancers can update invites they received (to accept/decline)
CREATE POLICY "Freelancers can update their received invites" 
ON public.project_invites 
FOR UPDATE 
USING (freelancer_user_id = auth.uid());

-- Companies can update their sent invites (to cancel)
CREATE POLICY "Companies can update their sent invites" 
ON public.project_invites 
FOR UPDATE 
USING (company_user_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_invites_freelancer ON public.project_invites(freelancer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_project_invites_company ON public.project_invites(company_user_id);
CREATE INDEX IF NOT EXISTS idx_project_invites_project ON public.project_invites(project_id);

-- Create unique constraint to prevent duplicate pending invites
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_invite 
ON public.project_invites(project_id, freelancer_user_id) 
WHERE status = 'pending';