-- FINAL FIX (must run last on 2026-02-01): remove self-referencing RLS that causes
-- "infinite recursion detected in policy for relation \"freelancer_profiles\"".
--
-- We intentionally avoid querying public.freelancer_profiles (or company_profiles)
-- inside the freelancer_profiles SELECT policy.

DROP POLICY IF EXISTS "Users can view freelancer profiles with context" ON public.freelancer_profiles;

CREATE POLICY "Users can view freelancer profiles with context"
ON public.freelancer_profiles
FOR SELECT
TO public
USING (
  -- Owner can always read their own profile (settings, dashboard, etc.)
  auth.uid() = user_id

  -- Admins
  OR is_admin()

  -- Companies with accepted proposals from this freelancer can read
  OR EXISTS (
    SELECT 1
    FROM proposals p
    JOIN projects pr ON pr.id = p.project_id
    WHERE p.freelancer_user_id = freelancer_profiles.user_id
      AND pr.company_user_id = auth.uid()
      AND p.status = 'accepted'::proposal_status
  )

  -- Any authenticated company/freelancer can read (talent pool / profile browsing)
  -- Use profiles to avoid recursion.
  OR EXISTS (
    SELECT 1
    FROM profiles me
    WHERE me.user_id = auth.uid()
      AND coalesce(me.user_type::text, '') IN ('freelancer', 'company')
  )
);
