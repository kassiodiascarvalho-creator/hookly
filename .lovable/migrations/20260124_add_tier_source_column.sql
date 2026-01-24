-- Add tier_source column to track whether tier is manual (admin) or from Stripe subscription
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS tier_source TEXT NOT NULL DEFAULT 'manual';

-- Add comment
COMMENT ON COLUMN public.freelancer_profiles.tier_source IS 'Source of tier: manual (admin set) or stripe (from subscription)';

-- Set existing PRO/TOP_RATED users with manual:tier subscription_id to tier_source='manual'
-- This preserves admin-set tiers
UPDATE public.freelancer_profiles fp
SET tier_source = 'manual'
WHERE tier IN ('pro', 'top_rated')
  AND EXISTS (
    SELECT 1 FROM public.plan_credit_grants pcg
    WHERE pcg.user_id = fp.user_id
      AND pcg.subscription_id LIKE 'manual:tier:%'
  );
