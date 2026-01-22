-- Allow freelancers with accepted proposals to view in_progress/completed projects
CREATE POLICY "Freelancers with accepted proposals can view projects"
  ON public.projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposals 
      WHERE proposals.project_id = projects.id 
      AND proposals.freelancer_user_id = auth.uid()
      AND proposals.status = 'accepted'
    )
  );