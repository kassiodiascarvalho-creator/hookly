-- ============================================
-- STEP 1: Add plan_source column to company_plans
-- (Schema only - function update will come separately)
-- ============================================

-- 1) Add the plan_source column with default 'manual'
ALTER TABLE public.company_plans 
ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'manual';

-- 2) Backfill: Set plan_source='stripe' for existing Stripe subscriptions
UPDATE public.company_plans 
SET plan_source = 'stripe' 
WHERE stripe_subscription_id IS NOT NULL 
  AND stripe_subscription_id != ''
  AND plan_source = 'manual';

-- 3) Add comment for documentation
COMMENT ON COLUMN public.company_plans.plan_source IS 
  'Source of plan assignment: "stripe" for Stripe subscriptions, "manual" for admin overrides. Only Stripe-sourced plans will be auto-downgraded on subscription cancellation.';
