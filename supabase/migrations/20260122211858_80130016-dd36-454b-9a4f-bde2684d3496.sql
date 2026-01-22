-- Fix infinite recursion in RLS between projects <-> proposals by using a SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.freelancer_can_view_project(p_project_id uuid, p_freelancer_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proposals p
    WHERE p.project_id = p_project_id
      AND p.freelancer_user_id = p_freelancer_user_id
      AND p.status = 'accepted'
  );
$$;

REVOKE ALL ON FUNCTION public.freelancer_can_view_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freelancer_can_view_project(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Freelancers with accepted proposals can view projects" ON public.projects;

CREATE POLICY "Freelancers with accepted proposals can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.freelancer_can_view_project(id, auth.uid())
);