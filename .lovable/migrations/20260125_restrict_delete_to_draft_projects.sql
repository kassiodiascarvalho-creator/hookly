-- Drop existing delete policy
DROP POLICY IF EXISTS "Companies can delete own projects" ON public.projects;

-- Create new policy that only allows deletion of draft projects
CREATE POLICY "Companies can delete own draft projects"
ON public.projects
FOR DELETE
USING (
  (auth.uid() = company_user_id AND status = 'draft')
  OR is_admin()
);
