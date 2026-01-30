-- ================================================================================
-- ADMIN PERMISSIONS SYSTEM
-- Owner (Super Admin) can manage sub-admins with limited permissions
-- ================================================================================

-- Create admin_permissions table to track what each admin can do
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  -- Permission flags
  can_manage_users BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_freelancers BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_companies BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_projects BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_payments BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_finances BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_tiers BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_payment_providers BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_landing_page BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_admins BOOLEAN NOT NULL DEFAULT FALSE, -- Only owner can have this
  -- Metadata
  added_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- RLS: Only admins can read
CREATE POLICY "admin_permissions_select" ON public.admin_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Only owner can insert/update/delete (handled by functions)
CREATE POLICY "admin_permissions_insert" ON public.admin_permissions
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "admin_permissions_update" ON public.admin_permissions
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "admin_permissions_delete" ON public.admin_permissions
  FOR DELETE TO authenticated
  USING (false);

-- Set the current admin (kassiodiascarvalho@gmail.com) as OWNER
INSERT INTO public.admin_permissions (
  user_id, 
  is_owner, 
  can_manage_users, 
  can_manage_freelancers, 
  can_manage_companies,
  can_manage_projects, 
  can_manage_payments, 
  can_manage_finances,
  can_manage_tiers, 
  can_manage_payment_providers, 
  can_manage_landing_page,
  can_manage_admins
)
VALUES (
  '7019e5f4-20f2-4e10-a4d5-461725d88885', -- Your user_id
  TRUE,  -- is_owner
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE -- All permissions
)
ON CONFLICT (user_id) DO UPDATE SET
  is_owner = TRUE,
  can_manage_users = TRUE,
  can_manage_freelancers = TRUE,
  can_manage_companies = TRUE,
  can_manage_projects = TRUE,
  can_manage_payments = TRUE,
  can_manage_finances = TRUE,
  can_manage_tiers = TRUE,
  can_manage_payment_providers = TRUE,
  can_manage_landing_page = TRUE,
  can_manage_admins = TRUE,
  updated_at = now();

-- Function to check if current user is the owner
CREATE OR REPLACE FUNCTION public.is_admin_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_permissions
    WHERE user_id = auth.uid() AND is_owner = TRUE
  )
$$;

-- Function to check specific admin permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  -- First check if user is admin at all
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN FALSE;
  END IF;
  
  -- Owner has all permissions
  IF public.is_admin_owner() THEN
    RETURN TRUE;
  END IF;
  
  -- Check specific permission
  EXECUTE format(
    'SELECT %I FROM public.admin_permissions WHERE user_id = $1',
    p_permission
  ) INTO v_result USING auth.uid();
  
  RETURN COALESCE(v_result, FALSE);
END;
$$;

-- Function to add a new admin (only owner can call)
CREATE OR REPLACE FUNCTION public.add_sub_admin(
  p_email TEXT,
  p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_user_id UUID;
  v_caller_id UUID;
  v_new_permission_id UUID;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is owner
  IF NOT public.is_admin_owner() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner can add admins');
  END IF;
  
  -- Find user by email
  SELECT user_id INTO v_target_user_id
  FROM public.profiles
  WHERE email = p_email;
  
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found with email: ' || p_email);
  END IF;
  
  -- Cannot add yourself
  IF v_target_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own permissions');
  END IF;
  
  -- Add to user_roles if not already admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Add permissions (never allow is_owner or can_manage_admins for sub-admins)
  INSERT INTO public.admin_permissions (
    user_id,
    is_owner,
    can_manage_users,
    can_manage_freelancers,
    can_manage_companies,
    can_manage_projects,
    can_manage_payments,
    can_manage_finances,
    can_manage_tiers,
    can_manage_payment_providers,
    can_manage_landing_page,
    can_manage_admins,
    added_by_user_id
  )
  VALUES (
    v_target_user_id,
    FALSE, -- Never owner
    COALESCE((p_permissions->>'can_manage_users')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_freelancers')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_companies')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_projects')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_payments')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_finances')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_tiers')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_payment_providers')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_landing_page')::boolean, FALSE),
    FALSE, -- Never can_manage_admins
    v_caller_id
  )
  ON CONFLICT (user_id) DO UPDATE SET
    can_manage_users = COALESCE((p_permissions->>'can_manage_users')::boolean, FALSE),
    can_manage_freelancers = COALESCE((p_permissions->>'can_manage_freelancers')::boolean, FALSE),
    can_manage_companies = COALESCE((p_permissions->>'can_manage_companies')::boolean, FALSE),
    can_manage_projects = COALESCE((p_permissions->>'can_manage_projects')::boolean, FALSE),
    can_manage_payments = COALESCE((p_permissions->>'can_manage_payments')::boolean, FALSE),
    can_manage_finances = COALESCE((p_permissions->>'can_manage_finances')::boolean, FALSE),
    can_manage_tiers = COALESCE((p_permissions->>'can_manage_tiers')::boolean, FALSE),
    can_manage_payment_providers = COALESCE((p_permissions->>'can_manage_payment_providers')::boolean, FALSE),
    can_manage_landing_page = COALESCE((p_permissions->>'can_manage_landing_page')::boolean, FALSE),
    updated_at = now()
  RETURNING id INTO v_new_permission_id;
  
  RETURN jsonb_build_object('success', true, 'permission_id', v_new_permission_id);
END;
$$;

-- Function to remove a sub-admin (only owner can call)
CREATE OR REPLACE FUNCTION public.remove_sub_admin(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_is_target_owner BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is owner
  IF NOT public.is_admin_owner() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner can remove admins');
  END IF;
  
  -- Check if target is owner (cannot remove owner)
  SELECT is_owner INTO v_is_target_owner
  FROM public.admin_permissions
  WHERE user_id = p_user_id;
  
  IF v_is_target_owner = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the owner');
  END IF;
  
  -- Cannot remove yourself
  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove yourself');
  END IF;
  
  -- Remove from user_roles
  DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin';
  
  -- Remove permissions
  DELETE FROM public.admin_permissions WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to update sub-admin permissions (only owner can call)
CREATE OR REPLACE FUNCTION public.update_sub_admin_permissions(
  p_user_id UUID,
  p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID;
  v_is_target_owner BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is owner
  IF NOT public.is_admin_owner() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner can update admin permissions');
  END IF;
  
  -- Check if target is owner (cannot modify owner)
  SELECT is_owner INTO v_is_target_owner
  FROM public.admin_permissions
  WHERE user_id = p_user_id;
  
  IF v_is_target_owner = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify owner permissions');
  END IF;
  
  -- Cannot modify yourself
  IF p_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own permissions');
  END IF;
  
  -- Update permissions (never allow is_owner or can_manage_admins)
  UPDATE public.admin_permissions SET
    can_manage_users = COALESCE((p_permissions->>'can_manage_users')::boolean, can_manage_users),
    can_manage_freelancers = COALESCE((p_permissions->>'can_manage_freelancers')::boolean, can_manage_freelancers),
    can_manage_companies = COALESCE((p_permissions->>'can_manage_companies')::boolean, can_manage_companies),
    can_manage_projects = COALESCE((p_permissions->>'can_manage_projects')::boolean, can_manage_projects),
    can_manage_payments = COALESCE((p_permissions->>'can_manage_payments')::boolean, can_manage_payments),
    can_manage_finances = COALESCE((p_permissions->>'can_manage_finances')::boolean, can_manage_finances),
    can_manage_tiers = COALESCE((p_permissions->>'can_manage_tiers')::boolean, can_manage_tiers),
    can_manage_payment_providers = COALESCE((p_permissions->>'can_manage_payment_providers')::boolean, can_manage_payment_providers),
    can_manage_landing_page = COALESCE((p_permissions->>'can_manage_landing_page')::boolean, can_manage_landing_page),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id ON public.admin_permissions(user_id);
