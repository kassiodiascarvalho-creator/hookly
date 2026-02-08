-- Add new permission columns to admin_permissions table
ALTER TABLE public.admin_permissions
ADD COLUMN IF NOT EXISTS can_manage_analytics boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_identity boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_feedbacks boolean NOT NULL DEFAULT false;

-- Grant analytics, identity and feedbacks permissions to the owner
UPDATE public.admin_permissions
SET can_manage_analytics = true,
    can_manage_identity = true,
    can_manage_feedbacks = true
WHERE is_owner = true;

-- Update the update_sub_admin_permissions function to handle the new columns
CREATE OR REPLACE FUNCTION public.update_sub_admin_permissions(
  p_user_id uuid,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_caller_owner boolean;
  v_is_target_owner boolean;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is owner
  SELECT is_owner INTO v_is_caller_owner
  FROM public.admin_permissions
  WHERE user_id = v_caller_id;
  
  IF NOT COALESCE(v_is_caller_owner, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only owner can update permissions');
  END IF;
  
  -- Check if target is owner (cannot modify owner)
  SELECT is_owner INTO v_is_target_owner
  FROM public.admin_permissions
  WHERE user_id = p_user_id;
  
  IF COALESCE(v_is_target_owner, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify owner permissions');
  END IF;
  
  -- Update permissions
  UPDATE public.admin_permissions
  SET 
    can_manage_users = COALESCE((p_permissions->>'can_manage_users')::boolean, can_manage_users),
    can_manage_freelancers = COALESCE((p_permissions->>'can_manage_freelancers')::boolean, can_manage_freelancers),
    can_manage_companies = COALESCE((p_permissions->>'can_manage_companies')::boolean, can_manage_companies),
    can_manage_projects = COALESCE((p_permissions->>'can_manage_projects')::boolean, can_manage_projects),
    can_manage_payments = COALESCE((p_permissions->>'can_manage_payments')::boolean, can_manage_payments),
    can_manage_finances = COALESCE((p_permissions->>'can_manage_finances')::boolean, can_manage_finances),
    can_manage_tiers = COALESCE((p_permissions->>'can_manage_tiers')::boolean, can_manage_tiers),
    can_manage_payment_providers = COALESCE((p_permissions->>'can_manage_payment_providers')::boolean, can_manage_payment_providers),
    can_manage_landing_page = COALESCE((p_permissions->>'can_manage_landing_page')::boolean, can_manage_landing_page),
    can_manage_admins = COALESCE((p_permissions->>'can_manage_admins')::boolean, can_manage_admins),
    can_manage_analytics = COALESCE((p_permissions->>'can_manage_analytics')::boolean, can_manage_analytics),
    can_manage_identity = COALESCE((p_permissions->>'can_manage_identity')::boolean, can_manage_identity),
    can_manage_feedbacks = COALESCE((p_permissions->>'can_manage_feedbacks')::boolean, can_manage_feedbacks),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update the add_sub_admin function to handle the new columns
CREATE OR REPLACE FUNCTION public.add_sub_admin(
  p_email text,
  p_permissions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_is_caller_owner boolean;
  v_target_user_id uuid;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is owner
  SELECT is_owner INTO v_is_caller_owner
  FROM public.admin_permissions
  WHERE user_id = v_caller_id;
  
  IF NOT COALESCE(v_is_caller_owner, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only owner can add sub-admins');
  END IF;
  
  -- Find user by email
  SELECT user_id INTO v_target_user_id
  FROM public.profiles
  WHERE email = p_email;
  
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found with this email');
  END IF;
  
  -- Check if already admin
  IF EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = v_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is already an admin');
  END IF;
  
  -- Insert new admin
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
    can_manage_analytics,
    can_manage_identity,
    can_manage_feedbacks,
    added_by_user_id
  ) VALUES (
    v_target_user_id,
    false,
    COALESCE((p_permissions->>'can_manage_users')::boolean, false),
    COALESCE((p_permissions->>'can_manage_freelancers')::boolean, false),
    COALESCE((p_permissions->>'can_manage_companies')::boolean, false),
    COALESCE((p_permissions->>'can_manage_projects')::boolean, false),
    COALESCE((p_permissions->>'can_manage_payments')::boolean, false),
    COALESCE((p_permissions->>'can_manage_finances')::boolean, false),
    COALESCE((p_permissions->>'can_manage_tiers')::boolean, false),
    COALESCE((p_permissions->>'can_manage_payment_providers')::boolean, false),
    COALESCE((p_permissions->>'can_manage_landing_page')::boolean, false),
    false,
    COALESCE((p_permissions->>'can_manage_analytics')::boolean, false),
    COALESCE((p_permissions->>'can_manage_identity')::boolean, false),
    COALESCE((p_permissions->>'can_manage_feedbacks')::boolean, false),
    v_caller_id
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;
