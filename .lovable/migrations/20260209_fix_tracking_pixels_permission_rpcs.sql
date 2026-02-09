-- ================================================================================
-- ADD can_manage_tracking_pixels TO ADMIN PERMISSIONS
-- ================================================================================

-- Add the column if not exists
ALTER TABLE public.admin_permissions 
ADD COLUMN IF NOT EXISTS can_manage_tracking_pixels BOOLEAN NOT NULL DEFAULT FALSE;

-- Update existing owner to have this permission
UPDATE public.admin_permissions 
SET can_manage_tracking_pixels = TRUE 
WHERE is_owner = TRUE;

-- Update add_sub_admin function to include tracking_pixels permission
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
    can_manage_tracking_pixels,
    can_manage_analytics,
    can_manage_identity,
    can_manage_feedbacks,
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
    COALESCE((p_permissions->>'can_manage_tracking_pixels')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_analytics')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_identity')::boolean, FALSE),
    COALESCE((p_permissions->>'can_manage_feedbacks')::boolean, FALSE),
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
    can_manage_tracking_pixels = COALESCE((p_permissions->>'can_manage_tracking_pixels')::boolean, FALSE),
    can_manage_analytics = COALESCE((p_permissions->>'can_manage_analytics')::boolean, FALSE),
    can_manage_identity = COALESCE((p_permissions->>'can_manage_identity')::boolean, FALSE),
    can_manage_feedbacks = COALESCE((p_permissions->>'can_manage_feedbacks')::boolean, FALSE),
    updated_at = now()
  RETURNING id INTO v_new_permission_id;
  
  RETURN jsonb_build_object('success', true, 'permission_id', v_new_permission_id);
END;
$$;

-- Update update_sub_admin_permissions function to include tracking_pixels permission
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
    can_manage_tracking_pixels = COALESCE((p_permissions->>'can_manage_tracking_pixels')::boolean, can_manage_tracking_pixels),
    can_manage_analytics = COALESCE((p_permissions->>'can_manage_analytics')::boolean, can_manage_analytics),
    can_manage_identity = COALESCE((p_permissions->>'can_manage_identity')::boolean, can_manage_identity),
    can_manage_feedbacks = COALESCE((p_permissions->>'can_manage_feedbacks')::boolean, can_manage_feedbacks),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
