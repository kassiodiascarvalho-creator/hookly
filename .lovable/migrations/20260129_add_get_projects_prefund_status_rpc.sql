-- Create a SECURITY DEFINER function to check project prefund status
-- This allows any authenticated user (including freelancers) to see if a project has verified payment
CREATE OR REPLACE FUNCTION public.get_projects_prefund_status(project_ids UUID[])
RETURNS TABLE (
  project_id UUID,
  has_verified_payment BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS project_id,
    EXISTS (
      SELECT 1 
      FROM unified_payments up 
      WHERE up.payment_type = 'project_prefund'
        AND up.status = 'paid'
        AND (up.metadata->>'project_id')::UUID = p.id
    ) AS has_verified_payment
  FROM unnest(project_ids) AS p(id);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_projects_prefund_status(UUID[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_projects_prefund_status IS 'Returns prefund status for multiple projects. Used to show Verified/Unverified Payment badges to all users.';
