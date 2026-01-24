-- RPC: retorna badge de plano + verificação para uma lista de empresas
-- (não retorna dados sensíveis, só plan_type efetivo e is_verified)

CREATE OR REPLACE FUNCTION public.get_company_badges(p_company_ids uuid[])
RETURNS TABLE (
  company_user_id uuid,
  plan_type text,
  is_verified boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.user_id AS company_user_id,
    CASE
      WHEN cp.company_user_id IS NULL THEN 'free'
      WHEN COALESCE(cp.plan_source,'manual') = 'manual' THEN COALESCE(cp.plan_type,'free')
      WHEN COALESCE(cp.plan_source,'stripe') = 'stripe'
           AND COALESCE(cp.status,'') IN ('active','trialing')
        THEN COALESCE(cp.plan_type,'free')
      ELSE 'free'
    END AS plan_type,
    COALESCE(pr.is_verified, false) AS is_verified
  FROM public.company_profiles pr
  LEFT JOIN public.company_plans cp
    ON cp.company_user_id = pr.user_id
  WHERE pr.user_id = ANY(p_company_ids);
$$;

REVOKE ALL ON FUNCTION public.get_company_badges(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_badges(uuid[]) TO authenticated;
