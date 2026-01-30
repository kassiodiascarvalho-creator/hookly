-- =============================================
-- IDENTITY VERIFICATION SECURITY HARDENING
-- Storage policies, file cleanup, rate limiting, admin features
-- =============================================

-- 1. Drop existing storage policies if they exist (to recreate with correct rules)
DROP POLICY IF EXISTS "Users can upload identity files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own identity files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all identity files" ON storage.objects;
DROP POLICY IF EXISTS "No direct identity file deletes" ON storage.objects;

-- 2. Create proper storage policies for identity_private bucket

-- Policy: Users can ONLY upload to their own folder {user_id}/
CREATE POLICY "identity_private: user upload own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity_private' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update/replace files in their own folder
CREATE POLICY "identity_private: user update own folder"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity_private' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view ONLY their own files
CREATE POLICY "identity_private: user view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity_private' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can view ALL files for review
CREATE POLICY "identity_private: admin view all files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity_private' AND
  public.is_admin()
);

-- Policy: Admins can delete files (for cleanup)
CREATE POLICY "identity_private: admin delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'identity_private' AND
  public.is_admin()
);

-- Policy: Service role only delete for regular users (handled by RPC)
-- Note: Service role bypasses RLS, so no policy needed for that

-- 3. Update bucket to ensure it's private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'identity_private';

-- 4. Add rate limiting table for identity verification
CREATE TABLE IF NOT EXISTS public.identity_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL, -- 'upload', 'start_session', 'finalize'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_rate_limits_user_action 
ON public.identity_rate_limits(user_id, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.identity_rate_limits ENABLE ROW LEVEL SECURITY;

-- No direct access - only via RPCs
CREATE POLICY "No direct identity_rate_limits access"
ON public.identity_rate_limits FOR ALL
USING (false)
WITH CHECK (false);

-- 5. Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_identity_rate_limit(
  p_user_id uuid,
  p_action text,
  p_max_requests integer DEFAULT 10,
  p_window_minutes integer DEFAULT 5
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count requests in window
  SELECT COUNT(*) INTO v_count
  FROM identity_rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND created_at > now() - (p_window_minutes || ' minutes')::interval;
  
  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;
  
  -- Record this request
  INSERT INTO identity_rate_limits (user_id, action)
  VALUES (p_user_id, p_action);
  
  -- Cleanup old entries (older than 1 hour)
  DELETE FROM identity_rate_limits
  WHERE created_at < now() - interval '1 hour';
  
  RETURN true;
END;
$$;

-- 6. Function to delete identity file from storage (called by service role)
CREATE OR REPLACE FUNCTION public.delete_identity_storage_file(
  p_storage_path text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This function is a placeholder for logging
  -- Actual storage deletion happens in Edge Function via service role
  RAISE NOTICE 'Storage file marked for deletion: %', p_storage_path;
  RETURN true;
END;
$$;

-- 7. Update register_identity_file to return old storage path for deletion
CREATE OR REPLACE FUNCTION public.register_identity_file(
  p_verification_id uuid,
  p_file_type text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_file_id uuid;
  v_old_path text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Rate limit check (10 uploads per 5 minutes)
  IF NOT check_identity_rate_limit(v_user_id, 'upload', 10, 5) THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait a few minutes.';
  END IF;

  -- Verify ownership
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id AND user_id = v_user_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found or not authorized';
  END IF;

  IF v_verification.status NOT IN ('pending', 'failed_soft') THEN
    RAISE EXCEPTION 'Cannot upload files for verification in status: %', v_verification.status;
  END IF;

  -- Get old storage path before deleting
  SELECT storage_path INTO v_old_path
  FROM identity_verification_files 
  WHERE identity_verification_id = p_verification_id AND file_type = p_file_type;

  -- Delete existing file of same type from DB
  DELETE FROM identity_verification_files 
  WHERE identity_verification_id = p_verification_id AND file_type = p_file_type;

  -- Insert new file record
  INSERT INTO identity_verification_files (
    identity_verification_id,
    file_type,
    storage_path,
    mime_type,
    size_bytes
  ) VALUES (
    p_verification_id,
    p_file_type,
    p_storage_path,
    p_mime_type,
    p_size_bytes
  )
  RETURNING id INTO v_file_id;

  -- Audit log
  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_id,
    actor_type,
    action,
    metadata
  ) VALUES (
    p_verification_id,
    v_user_id,
    'user',
    'file_uploaded',
    jsonb_build_object(
      'file_type', p_file_type, 
      'size_bytes', p_size_bytes,
      'replaced_old_file', v_old_path IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'file_id', v_file_id,
    'old_storage_path', v_old_path
  );
END;
$$;

-- 8. Function for admin to delete all evidence files
CREATE OR REPLACE FUNCTION public.admin_delete_identity_evidence(
  p_verification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_files text[];
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  -- Get all file paths
  SELECT ARRAY_AGG(storage_path) INTO v_files
  FROM identity_verification_files
  WHERE identity_verification_id = p_verification_id;

  -- Delete file records from DB
  DELETE FROM identity_verification_files
  WHERE identity_verification_id = p_verification_id;

  -- Audit log
  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_id,
    actor_type,
    action,
    metadata
  ) VALUES (
    p_verification_id,
    auth.uid(),
    'admin',
    'evidence_deleted',
    jsonb_build_object('files_deleted', v_files)
  );

  RETURN jsonb_build_object(
    'success', true,
    'files_to_delete', v_files
  );
END;
$$;

-- 9. Function to get verifications for cleanup (older than X days)
CREATE OR REPLACE FUNCTION public.get_identity_verifications_for_cleanup(
  p_days_old integer DEFAULT 30
)
RETURNS TABLE (
  verification_id uuid,
  user_id uuid,
  status text,
  storage_paths text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    iv.id as verification_id,
    iv.user_id,
    iv.status,
    ARRAY_AGG(ivf.storage_path) FILTER (WHERE ivf.storage_path IS NOT NULL) as storage_paths
  FROM identity_verifications iv
  LEFT JOIN identity_verification_files ivf ON ivf.identity_verification_id = iv.id
  WHERE iv.status IN ('verified', 'rejected')
    AND iv.updated_at < now() - (p_days_old || ' days')::interval
  GROUP BY iv.id, iv.user_id, iv.status;
END;
$$;

-- 10. Add rate limit check to create_identity_verification_with_uploads
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

  -- Create verification record
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
    'pending',
    p_country,
    p_document_type,
    'internal',
    v_verification_id::text,
    v_new_attempts,
    true,
    now(),
    jsonb_build_object('has_back_side', p_has_back_side, 'required_files', v_required_files)
  );

  -- Update profile status
  IF p_subject_type = 'freelancer' THEN
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
    new_status,
    metadata
  ) VALUES (
    v_verification_id,
    p_user_id,
    'user',
    'verification_started',
    'pending',
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
    'max_attempts', 2
  );
END;
$$;

-- 11. RPC to get admin identity verifications list
CREATE OR REPLACE FUNCTION public.get_identity_verifications_admin(
  p_status_filter text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  subject_type text,
  status text,
  country text,
  document_type text,
  provider text,
  risk_score numeric,
  risk_level text,
  failure_reason text,
  attempts integer,
  max_attempts integer,
  created_at timestamptz,
  updated_at timestamptz,
  verified_at timestamptz,
  reviewed_by_admin_id uuid,
  admin_decision text,
  admin_notes text,
  admin_decision_at timestamptz,
  display_name text,
  avatar_url text,
  email text,
  files_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get total count
  SELECT COUNT(*)::bigint INTO v_total
  FROM identity_verifications iv
  LEFT JOIN profiles p ON p.user_id = iv.user_id
  LEFT JOIN freelancer_profiles fp ON fp.user_id = iv.user_id AND iv.subject_type = 'freelancer'
  LEFT JOIN company_profiles cp ON cp.user_id = iv.user_id AND iv.subject_type = 'company'
  WHERE (p_status_filter IS NULL OR iv.status = p_status_filter)
    AND (p_search IS NULL OR p_search = '' OR 
         p.email ILIKE '%' || p_search || '%' OR
         COALESCE(fp.full_name, cp.company_name) ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT 
    iv.id,
    iv.user_id,
    iv.subject_type,
    iv.status,
    iv.country,
    iv.document_type,
    iv.provider,
    iv.risk_score,
    iv.risk_level,
    iv.failure_reason,
    iv.attempts,
    iv.max_attempts,
    iv.created_at,
    iv.updated_at,
    iv.verified_at,
    iv.reviewed_by_admin_id,
    iv.admin_decision,
    iv.admin_notes,
    iv.admin_decision_at,
    CASE 
      WHEN iv.subject_type = 'freelancer' THEN fp.full_name
      ELSE cp.company_name
    END as display_name,
    CASE 
      WHEN iv.subject_type = 'freelancer' THEN fp.avatar_url
      ELSE cp.logo_url
    END as avatar_url,
    p.email,
    (SELECT COUNT(*)::bigint FROM identity_verification_files ivf WHERE ivf.identity_verification_id = iv.id) as files_count,
    v_total as total_count
  FROM identity_verifications iv
  LEFT JOIN profiles p ON p.user_id = iv.user_id
  LEFT JOIN freelancer_profiles fp ON fp.user_id = iv.user_id AND iv.subject_type = 'freelancer'
  LEFT JOIN company_profiles cp ON cp.user_id = iv.user_id AND iv.subject_type = 'company'
  WHERE (p_status_filter IS NULL OR iv.status = p_status_filter)
    AND (p_search IS NULL OR p_search = '' OR 
         p.email ILIKE '%' || p_search || '%' OR
         COALESCE(fp.full_name, cp.company_name) ILIKE '%' || p_search || '%')
  ORDER BY 
    CASE WHEN iv.status = 'manual_review' THEN 0 ELSE 1 END,
    iv.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 12. RPC to get verification details for admin review
CREATE OR REPLACE FUNCTION public.get_identity_verification_detail(
  p_verification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_verification RECORD;
  v_files jsonb;
  v_audit_logs jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Get files
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ivf.id,
    'file_type', ivf.file_type,
    'storage_path', ivf.storage_path,
    'mime_type', ivf.mime_type,
    'size_bytes', ivf.size_bytes,
    'quality_score', ivf.quality_score,
    'quality_issues', ivf.quality_issues,
    'created_at', ivf.created_at
  ) ORDER BY 
    CASE ivf.file_type 
      WHEN 'document_front' THEN 1 
      WHEN 'document_back' THEN 2 
      WHEN 'selfie' THEN 3 
    END
  ), '[]'::jsonb) INTO v_files
  FROM identity_verification_files ivf
  WHERE ivf.identity_verification_id = p_verification_id;

  -- Get audit logs (last 20)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ial.id,
    'actor_id', ial.actor_id,
    'actor_type', ial.actor_type,
    'action', ial.action,
    'previous_status', ial.previous_status,
    'new_status', ial.new_status,
    'metadata', ial.metadata,
    'created_at', ial.created_at
  ) ORDER BY ial.created_at DESC), '[]'::jsonb) INTO v_audit_logs
  FROM (
    SELECT * FROM identity_audit_logs
    WHERE identity_verification_id = p_verification_id
    ORDER BY created_at DESC
    LIMIT 20
  ) ial;

  -- Build result
  v_result := jsonb_build_object(
    'verification', jsonb_build_object(
      'id', v_verification.id,
      'user_id', v_verification.user_id,
      'subject_type', v_verification.subject_type,
      'status', v_verification.status,
      'country', v_verification.country,
      'document_type', v_verification.document_type,
      'provider', v_verification.provider,
      'risk_score', v_verification.risk_score,
      'risk_level', v_verification.risk_level,
      'failure_reason', v_verification.failure_reason,
      'attempts', v_verification.attempts,
      'max_attempts', v_verification.max_attempts,
      'metadata', v_verification.metadata,
      'created_at', v_verification.created_at,
      'updated_at', v_verification.updated_at,
      'verified_at', v_verification.verified_at,
      'reviewed_by_admin_id', v_verification.reviewed_by_admin_id,
      'admin_decision', v_verification.admin_decision,
      'admin_notes', v_verification.admin_notes,
      'admin_decision_at', v_verification.admin_decision_at
    ),
    'files', v_files,
    'audit_logs', v_audit_logs
  );

  RETURN v_result;
END;
$$;

-- 13. Update get_identity_status to return more info
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
BEGIN
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'not_started',
      'attempts', 0,
      'max_attempts', 2,
      'can_start_verification', true
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_verification.status,
    'verification_id', v_verification.id,
    'attempts', v_verification.attempts,
    'max_attempts', v_verification.max_attempts,
    'can_start_verification', 
      v_verification.status IN ('not_started', 'failed_soft') 
      AND v_verification.attempts < v_verification.max_attempts
      AND NOT (v_verification.status = 'manual_review' AND v_verification.admin_decision IS NULL)
      AND v_verification.status != 'verified',
    'verified_at', v_verification.verified_at,
    'failure_reason', v_verification.failure_reason,
    'risk_score', v_verification.risk_score,
    'risk_level', v_verification.risk_level,
    'admin_decision', v_verification.admin_decision
  );
END;
$$;
