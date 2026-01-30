-- Add 'uploading' as an intermediate status before 'pending'
-- Status flow: not_started -> uploading (during file upload) -> pending (after finalize)

-- 1. Update create_identity_verification_with_uploads to use 'uploading' instead of 'pending'
CREATE OR REPLACE FUNCTION public.create_identity_verification_with_uploads(
  p_user_id uuid,
  p_subject_type text,
  p_country text,
  p_document_type text,
  p_has_back_side boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification_id uuid;
  v_existing RECORD;
  v_new_attempts integer;
  v_upload_prefix text;
  v_required_files text[];
BEGIN
  -- Rate limit check (3 start sessions per 10 minutes)
  IF NOT check_identity_rate_limit(p_user_id, 'start_session', 3, 10) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limit_exceeded');
  END IF;

  -- Check existing verification
  SELECT * INTO v_existing
  FROM identity_verifications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'verified' THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_verified');
    END IF;
    IF v_existing.status = 'manual_review' AND v_existing.admin_decision IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'blocked_manual_review');
    END IF;
    IF v_existing.status = 'rejected' AND v_existing.admin_decision = 'rejected' THEN
      RETURN jsonb_build_object('success', false, 'error', 'rejected');
    END IF;
    -- Allow continuing upload if still in uploading status
    IF v_existing.status = 'uploading' THEN
      RETURN jsonb_build_object(
        'success', true, 
        'verification_id', v_existing.id,
        'upload_prefix', p_user_id::text || '/' || v_existing.id::text || '/',
        'required_files', v_existing.metadata->'required_files',
        'attempts', v_existing.attempts,
        'max_attempts', v_existing.max_attempts,
        'status', v_existing.status,
        'message', 'upload_in_progress'
      );
    END IF;
    IF v_existing.status = 'pending' OR v_existing.status = 'processing' THEN
      -- Return existing verification
      RETURN jsonb_build_object(
        'success', true, 
        'verification_id', v_existing.id,
        'upload_prefix', p_user_id::text || '/' || v_existing.id::text || '/',
        'required_files', v_existing.metadata->'required_files',
        'attempts', v_existing.attempts,
        'max_attempts', v_existing.max_attempts,
        'status', v_existing.status,
        'message', 'verification_in_progress'
      );
    END IF;
    IF v_existing.attempts >= v_existing.max_attempts THEN
      RETURN jsonb_build_object('success', false, 'error', 'max_attempts_reached');
    END IF;
    v_new_attempts := v_existing.attempts + 1;
  ELSE
    v_new_attempts := 1;
  END IF;

  -- Generate verification ID
  v_verification_id := gen_random_uuid();
  
  -- Upload prefix: {user_id}/{verification_id}/
  v_upload_prefix := p_user_id::text || '/' || v_verification_id::text || '/';
  
  -- Required files based on document type
  IF p_has_back_side THEN
    v_required_files := ARRAY['document_front', 'document_back', 'selfie'];
  ELSE
    v_required_files := ARRAY['document_front', 'selfie'];
  END IF;

  -- Create verification record with 'uploading' status (not 'pending' yet)
  INSERT INTO identity_verifications (
    id,
    user_id,
    subject_type,
    status,
    country,
    document_type,
    provider,
    provider_session_id,
    attempts,
    consent_given,
    consent_given_at,
    metadata
  ) VALUES (
    v_verification_id,
    p_user_id,
    p_subject_type,
    'uploading',  -- Changed from 'pending' to 'uploading'
    p_country,
    p_document_type,
    'internal',
    v_verification_id::text,
    v_new_attempts,
    true,
    now(),
    jsonb_build_object('has_back_side', p_has_back_side, 'required_files', v_required_files)
  );

  -- DO NOT update profile status yet - only when finalized
  -- Profile status stays as 'not_started' until user clicks "Enviar para análise"

  -- Audit log
  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_id,
    actor_type,
    action,
    new_status,
    metadata
  ) VALUES (
    v_verification_id,
    p_user_id,
    'user',
    'upload_started',
    'uploading',
    jsonb_build_object(
      'country', p_country, 
      'document_type', p_document_type, 
      'attempt', v_new_attempts,
      'has_back_side', p_has_back_side
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'verification_id', v_verification_id,
    'upload_prefix', v_upload_prefix,
    'required_files', v_required_files,
    'attempts', v_new_attempts,
    'max_attempts', 5,
    'status', 'uploading',
    'message', 'upload_session_created'
  );
END;
$$;

-- 2. Update finalize_identity_uploads to change status from 'uploading' to 'pending'
CREATE OR REPLACE FUNCTION public.finalize_identity_uploads(
  p_verification_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_files_count integer;
  v_required_files text[];
  v_uploaded_files text[];
  v_missing_files text[];
  v_subject_type text;
BEGIN
  -- Get verification
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id AND user_id = p_user_id;

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'verification_not_found');
  END IF;

  -- Must be in 'uploading' status to finalize
  IF v_verification.status NOT IN ('uploading', 'failed_soft') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'invalid_status',
      'message', 'Verification must be in uploading or failed_soft status to finalize'
    );
  END IF;

  -- Get required files
  v_required_files := ARRAY(
    SELECT jsonb_array_elements_text(v_verification.metadata->'required_files')
  );

  -- Get uploaded files
  SELECT ARRAY_AGG(file_type) INTO v_uploaded_files
  FROM identity_verification_files
  WHERE identity_verification_id = p_verification_id;

  -- Check for missing files
  SELECT ARRAY_AGG(rf) INTO v_missing_files
  FROM unnest(v_required_files) AS rf
  WHERE rf NOT IN (SELECT unnest(COALESCE(v_uploaded_files, ARRAY[]::text[])));

  IF v_missing_files IS NOT NULL AND array_length(v_missing_files, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'missing_files',
      'missing', v_missing_files,
      'message', 'Please upload all required files: ' || array_to_string(v_missing_files, ', ')
    );
  END IF;

  -- Get subject type for profile update
  v_subject_type := v_verification.subject_type;

  -- Update status to 'pending' (now it's officially submitted for analysis)
  UPDATE identity_verifications
  SET 
    status = 'pending',
    updated_at = now()
  WHERE id = p_verification_id;

  -- NOW update profile status to pending (after user clicked "Enviar para análise")
  IF v_subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles SET identity_status = 'pending' WHERE user_id = p_user_id;
  ELSE
    UPDATE company_profiles SET identity_status = 'pending' WHERE user_id = p_user_id;
  END IF;

  -- Audit log
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
    p_user_id,
    'user',
    'uploads_finalized',
    'uploading',
    'pending',
    jsonb_build_object('files_count', array_length(v_uploaded_files, 1))
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'pending',
    'message', 'Documentos enviados para análise'
  );
END;
$$;

-- 3. Update get_identity_status to properly return 'not_started' when status is 'uploading' (from card perspective)
-- Actually, we want to show the actual status, so the card can handle it
CREATE OR REPLACE FUNCTION public.get_identity_status(
  p_user_id uuid,
  p_subject_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_result jsonb;
BEGIN
  -- Get the most recent verification
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE user_id = p_user_id AND subject_type = p_subject_type
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_started',
      'attempts', 0,
      'max_attempts', 5,
      'can_start_verification', true
    );
  END IF;

  -- For 'uploading' status, user can still modify/restart the upload session
  -- But from the card perspective, they haven't "submitted" yet
  v_result := jsonb_build_object(
    'status', v_verification.status,
    'verification_id', v_verification.id,
    'attempts', v_verification.attempts,
    'max_attempts', v_verification.max_attempts,
    'can_start_verification', (
      v_verification.status IN ('not_started', 'uploading', 'failed_soft', 'rejected') 
      AND v_verification.attempts < v_verification.max_attempts
    ),
    'verified_at', v_verification.verified_at,
    'failure_reason', v_verification.failure_reason,
    'risk_score', v_verification.risk_score,
    'risk_level', v_verification.risk_level,
    'admin_decision', v_verification.admin_decision
  );

  RETURN v_result;
END;
$$;
