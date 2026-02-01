-- Re-apply fix: infinite recursion in RLS policy for public.freelancer_profiles
--
-- Some environments may have already applied the earlier migration with a
-- self-referencing policy. Changing an old migration file does not re-run it,
-- so we ship this v2 migration to ensure the correct policy is applied.

-- Drop any legacy policies that could exist
DROP POLICY IF EXISTS "Freelancer profiles are viewable by everyone" ON public.freelancer_profiles;
DROP POLICY IF EXISTS "Users can view freelancer profiles with context" ON public.freelancer_profiles;

-- Create non-recursive SELECT policy
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
  -- Freelancers can view other freelancers (e.g., talent pool) - avoid recursion
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
