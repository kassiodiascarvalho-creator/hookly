-- Allow admins to view all platform_credits records
CREATE POLICY "Admins can view all platform credits"
ON public.platform_credits
FOR SELECT
USING (is_admin());