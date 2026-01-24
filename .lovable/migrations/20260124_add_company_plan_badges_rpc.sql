-- RPC to get public company plan badges (bypasses RLS safely)
-- Allows freelancers to see company plan types without direct table access
CREATE OR REPLACE FUNCTION public.get_company_plan_badges(p_company_ids uuid[])
RETURNS TABLE(company_user_id uuid, plan_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cp.company_user_id,
    CASE
      WHEN cp.plan_source = 'manual' THEN cp.plan_type
      WHEN cp.plan_source = 'stripe' AND cp.status IN ('active','trialing') THEN cp.plan_type
      ELSE 'free'
    END AS plan_type
  FROM public.company_plans cp
  WHERE cp.company_user_id = ANY(p_company_ids);
$$;

-- Secure permissions: only authenticated users can call
REVOKE ALL ON FUNCTION public.get_company_plan_badges(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_plan_badges(uuid[]) TO authenticated;
