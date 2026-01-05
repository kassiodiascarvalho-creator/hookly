-- Create admin-only RLS policies for management access
-- These policies allow admins to read all data for management purposes

-- Profiles - admin read access
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Company profiles - admin read access  
CREATE POLICY "Admins can view all company profiles"
ON public.company_profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Freelancer profiles - admin full access (for verification toggle)
CREATE POLICY "Admins can view all freelancer profiles"
ON public.freelancer_profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update freelancer profiles"
ON public.freelancer_profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Projects - admin read access
CREATE POLICY "Admins can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Payments - admin read access
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Leads - admin full access
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (public.is_admin());