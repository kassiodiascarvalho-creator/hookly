-- Fix: infinite recursion in RLS policy for public.freelancer_profiles
--
-- The previous policy referenced public.freelancer_profiles inside its own USING clause
-- (via an EXISTS subquery), which triggers Postgres' "infinite recursion detected" error.
-- This breaks any SELECT on freelancer_profiles (including the Settings page), preventing
-- the freelancer form and avatar URL from loading.

DROP POLICY IF EXISTS "Users can view freelancer profiles with context" ON public.freelancer_profiles;

CREATE POLICY "Users can view freelancer profiles with context"
ON public.freelancer_profiles FOR SELECT
USING (
  -- Own profile
  auth.uid() = user_id
  -- Admin
  OR is_admin()
  -- Companies with accepted proposals from this freelancer
  OR EXISTS (
    SELECT 1 FROM proposals p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.freelancer_user_id = freelancer_profiles.user_id
      AND pr.company_user_id = auth.uid()
      AND p.status = 'accepted'
  )
  -- Freelancers can view other freelancers (e.g., talent pool) - avoid self-referencing freelancer_profiles
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'freelancer'
  )
  -- Companies can view freelancers (e.g., hiring) - avoid relying on company_profiles RLS
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'company'
  )
);
