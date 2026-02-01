-- Drop existing public access policy
DROP POLICY IF EXISTS "Freelancer profiles are viewable by everyone" ON public.freelancer_profiles;

-- Create new restrictive SELECT policy (only owner, admin, or authenticated users)
-- FIXED: Uses profiles table instead of self-referencing freelancer_profiles to avoid infinite recursion
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
  -- Freelancers viewing other freelancers (for talent pool) - uses profiles to avoid recursion
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'freelancer'
  )
  -- Companies viewing freelancers (for hiring) - uses profiles to avoid recursion
  OR EXISTS (
    SELECT 1 FROM profiles me
    WHERE me.user_id = auth.uid()
      AND me.user_type = 'company'
  )
);

-- Create a public view with only non-sensitive fields for unauthenticated access
CREATE OR REPLACE VIEW public.freelancer_profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  title,
  bio,
  skills,
  -- Mask exact location - only show country
  country,
  country_code,
  languages,
  avatar_url,
  hourly_rate,
  verified,
  tier,
  created_at
  -- Excluded sensitive fields:
  -- document_type, document_number (PII)
  -- identity_status, identity_verified_at (verification status)
  -- total_revenue (financial)
  -- proposal_credits (platform internal)
  -- preferred_payout_currency, currency_code (financial)
  -- tier_source (platform internal)
  -- verified_at, verified_by_admin_id (admin internal)
  -- location (exact location is sensitive)
FROM public.freelancer_profiles;

-- Grant SELECT on the view to anon and authenticated
GRANT SELECT ON public.freelancer_profiles_public TO anon, authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.freelancer_profiles_public IS 'Public view of freelancer profiles with sensitive fields masked. Use this for public-facing features like talent pool browsing by unauthenticated users.';
