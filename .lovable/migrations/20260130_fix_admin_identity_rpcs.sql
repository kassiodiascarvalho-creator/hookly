-- Fix admin identity RPCs to accept admin_id parameter
-- Since these are called from Edge Functions using service role key,
-- auth.uid() returns NULL. We pass the admin_id from the edge function
-- after it has already verified admin permissions.

-- 1. Fix admin_reset_identity_verification
CREATE OR REPLACE FUNCTION public.admin_reset_identity_verification(
  p_verification_id uuid,
  p_notes text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_admin_id uuid;
BEGIN
  -- Use provided admin_id (from edge function) or fall back to auth.uid()
  v_admin_id := COALESCE(p_admin_id, auth.uid());
  
  -- If called directly (not via edge function), verify admin status
  IF p_admin_id IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  UPDATE identity_verifications
  SET 
    status = 'not_started',
    attempts = 0,
    admin_decision = NULL,
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at = now()
  WHERE id = p_verification_id;

  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles SET identity_status = 'not_started' WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles SET identity_status = 'not_started' WHERE user_id = v_verification.user_id;
  END IF;

  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_id,
    actor_type,
    action,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    p_verification_id,
    v_admin_id,
    'admin',
    'reset_verification',
    v_verification.status,
    'not_started',
    jsonb_build_object('notes', p_notes)
  );

  RETURN TRUE;
END;
$$;

-- 2. Fix admin_review_identity
CREATE OR REPLACE FUNCTION public.admin_review_identity(
  p_verification_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL,
  p_admin_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_admin_id uuid;
  v_new_status text;
BEGIN
  -- Use provided admin_id (from edge function) or fall back to auth.uid()
  v_admin_id := COALESCE(p_admin_id, auth.uid());
  
  -- If called directly (not via edge function), verify admin status
  IF p_admin_id IS NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  v_new_status := CASE WHEN p_decision = 'approved' THEN 'verified' ELSE 'rejected' END;

  UPDATE identity_verifications
  SET 
    status = v_new_status,
    admin_decision = p_decision,
    admin_decision_at = now(),
    admin_notes = p_notes,
    reviewed_by_admin_id = v_admin_id,
    verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_verification_id;

  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END
    WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END
    WHERE user_id = v_verification.user_id;
  END IF;

  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_id,
    actor_type,
    action,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    p_verification_id,
    v_admin_id,
    'admin',
    'admin_review',
    v_verification.status,
    v_new_status,
    jsonb_build_object('decision', p_decision, 'notes', p_notes)
  );

  RETURN TRUE;
END;
$$;
