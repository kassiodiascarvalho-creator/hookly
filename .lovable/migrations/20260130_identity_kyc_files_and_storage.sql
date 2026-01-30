-- =============================================
-- IDENTITY VERIFICATION FILES + STORAGE
-- Provider-agnostic architecture (internal, persona, veriff, onfido, stripe)
-- =============================================

-- 1. Create identity_verification_files table
CREATE TABLE IF NOT EXISTS public.identity_verification_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_verification_id uuid NOT NULL REFERENCES public.identity_verifications(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('document_front', 'document_back', 'selfie')),
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  quality_score numeric, -- 0 to 1
  quality_issues text[], -- ['blurry', 'low_light', 'reflection', etc.]
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_identity_files_verification_id ON public.identity_verification_files(identity_verification_id);
CREATE INDEX IF NOT EXISTS idx_identity_files_type ON public.identity_verification_files(file_type);

-- 3. Enable RLS
ALTER TABLE public.identity_verification_files ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for identity_verification_files
CREATE POLICY "Users can view own identity files" ON public.identity_verification_files
  FOR SELECT USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.identity_verifications iv 
      WHERE iv.id = identity_verification_id AND iv.user_id = auth.uid()
    )
  );

CREATE POLICY "No direct identity_files inserts from client" ON public.identity_verification_files
  FOR INSERT WITH CHECK (false);

CREATE POLICY "No direct identity_files updates" ON public.identity_verification_files
  FOR UPDATE USING (false);

CREATE POLICY "No direct identity_files deletes" ON public.identity_verification_files
  FOR DELETE USING (false);

-- 5. Update identity_verifications table to add provider flexibility
-- Add provider column if not exists (should already exist from previous migration)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'identity_verifications' AND column_name = 'provider') THEN
    ALTER TABLE public.identity_verifications 
      ADD COLUMN provider text NOT NULL DEFAULT 'internal';
  ELSE
    -- Update default to 'internal' for manual verification flow
    ALTER TABLE public.identity_verifications 
      ALTER COLUMN provider SET DEFAULT 'internal';
  END IF;
END $$;

-- Update check constraint to include all providers
ALTER TABLE public.identity_verifications 
  DROP CONSTRAINT IF EXISTS identity_verifications_provider_check;

-- Add new check with all supported providers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'identity_verifications_provider_check'
  ) THEN
    ALTER TABLE public.identity_verifications
      ADD CONSTRAINT identity_verifications_provider_check 
      CHECK (provider IN ('internal', 'persona', 'veriff', 'onfido', 'stripe_identity', 'mock'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Add risk_score column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'identity_verifications' AND column_name = 'risk_score') THEN
    ALTER TABLE public.identity_verifications 
      ADD COLUMN risk_score numeric;
  END IF;
END $$;

-- 7. Create private storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity_private',
  'identity_private',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 8. Storage RLS Policies for identity_private bucket

-- Policy: Users can upload files to their own verification folder
CREATE POLICY "Users can upload identity files" ON storage.objects
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'identity_private' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can view their own identity files
CREATE POLICY "Users can view own identity files" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'identity_private' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      is_admin()
    )
  );

-- Policy: Admins can view all identity files (for review)
CREATE POLICY "Admins can view all identity files" ON storage.objects
  FOR SELECT 
  USING (
    bucket_id = 'identity_private' AND
    is_admin()
  );

-- Policy: No public delete - only system can delete
CREATE POLICY "No direct identity file deletes" ON storage.objects
  FOR DELETE 
  USING (
    bucket_id = 'identity_private' AND
    false -- Only service role can delete
  );

-- 9. Function to create verification session with file upload paths
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
    IF v_existing.status IN ('manual_review') AND v_existing.admin_decision IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'blocked_manual_review');
    END IF;
    IF v_existing.status = 'rejected' THEN
      RETURN jsonb_build_object('success', false, 'error', 'rejected');
    END IF;
    IF v_existing.status NOT IN ('not_started', 'failed_soft') THEN
      -- Already in progress
      RETURN jsonb_build_object(
        'success', true, 
        'verification_id', v_existing.id,
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
    v_verification_id::text, -- Use verification_id as session_id for internal provider
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

-- 10. Function to register uploaded file
CREATE OR REPLACE FUNCTION public.register_identity_file(
  p_verification_id uuid,
  p_file_type text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_file_id uuid;
BEGIN
  -- Verify ownership
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id AND user_id = auth.uid();

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found or not authorized';
  END IF;

  IF v_verification.status NOT IN ('pending', 'failed_soft') THEN
    RAISE EXCEPTION 'Cannot upload files for verification in status: %', v_verification.status;
  END IF;

  -- Delete existing file of same type
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
    auth.uid(),
    'user',
    'file_uploaded',
    jsonb_build_object('file_type', p_file_type, 'size_bytes', p_size_bytes)
  );

  RETURN v_file_id;
END;
$$;

-- 11. Function to finalize uploads and start processing
CREATE OR REPLACE FUNCTION public.finalize_identity_uploads(
  p_verification_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_required_files text[];
  v_uploaded_files text[];
  v_missing_files text[];
BEGIN
  -- Verify ownership
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id AND user_id = auth.uid();

  IF v_verification IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_verification.status NOT IN ('pending', 'failed_soft') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status', 'status', v_verification.status);
  END IF;

  -- Get required files
  v_required_files := ARRAY(
    SELECT jsonb_array_elements_text(v_verification.metadata->'required_files')
  );

  -- Get uploaded files
  SELECT ARRAY_AGG(file_type) INTO v_uploaded_files
  FROM identity_verification_files
  WHERE identity_verification_id = p_verification_id;

  -- Check missing files
  v_missing_files := ARRAY(
    SELECT unnest(v_required_files)
    EXCEPT
    SELECT unnest(COALESCE(v_uploaded_files, ARRAY[]::text[]))
  );

  IF array_length(v_missing_files, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'missing_files', 
      'missing', v_missing_files
    );
  END IF;

  -- Update status to processing
  UPDATE identity_verifications
  SET 
    status = 'processing',
    updated_at = now()
  WHERE id = p_verification_id;

  -- Update profile status
  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles SET identity_status = 'processing' WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles SET identity_status = 'processing' WHERE user_id = v_verification.user_id;
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
    auth.uid(),
    'user',
    'uploads_finalized',
    v_verification.status,
    'processing',
    jsonb_build_object('uploaded_files', v_uploaded_files)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'processing',
    'message', 'Verificação iniciada. Você receberá uma notificação quando a análise for concluída.'
  );
END;
$$;

-- 12. Function to process verification (called by Edge Function after quality checks)
CREATE OR REPLACE FUNCTION public.process_identity_verification(
  p_verification_id uuid,
  p_status text,
  p_risk_score numeric DEFAULT NULL,
  p_risk_level text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_quality_results jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_new_status text;
  v_file RECORD;
BEGIN
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  -- Determine new status
  v_new_status := CASE
    WHEN p_status = 'manual_review' THEN 'manual_review'
    WHEN p_status = 'failed_soft' THEN 
      CASE WHEN v_verification.attempts >= v_verification.max_attempts THEN 'manual_review' ELSE 'failed_soft' END
    WHEN p_status = 'verified' THEN 'verified' -- Rare for internal provider
    ELSE 'manual_review' -- Default to manual review for safety
  END;

  -- Update verification
  UPDATE identity_verifications
  SET 
    status = v_new_status,
    risk_score = COALESCE(p_risk_score, risk_score),
    risk_level = COALESCE(p_risk_level, risk_level),
    failure_reason = COALESCE(p_failure_reason, failure_reason),
    verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE verified_at END,
    metadata = metadata || p_quality_results,
    updated_at = now()
  WHERE id = p_verification_id;

  -- Update file quality scores if provided
  FOR v_file IN 
    SELECT * FROM jsonb_each(p_quality_results->'files')
  LOOP
    UPDATE identity_verification_files
    SET 
      quality_score = (v_file.value->>'score')::numeric,
      quality_issues = ARRAY(SELECT jsonb_array_elements_text(v_file.value->'issues'))
    WHERE identity_verification_id = p_verification_id 
      AND file_type = v_file.key;
  END LOOP;

  -- Update profile status
  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE identity_verified_at END
    WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE identity_verified_at END
    WHERE user_id = v_verification.user_id;
  END IF;

  -- Audit log
  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_type,
    action,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    p_verification_id,
    'system',
    'verification_processed',
    v_verification.status,
    v_new_status,
    jsonb_build_object(
      'risk_score', p_risk_score, 
      'risk_level', p_risk_level, 
      'failure_reason', p_failure_reason,
      'quality_results', p_quality_results
    )
  );

  -- Notifications
  IF v_new_status = 'verified' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '✅ Sua identidade foi verificada com sucesso!', '/settings?tab=profile');
  ELSIF v_new_status = 'failed_soft' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '⚠️ Houve um problema com as fotos enviadas. Por favor, tente novamente.', '/settings?tab=profile');
  ELSIF v_new_status = 'manual_review' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '🔍 Sua verificação está em análise manual. Aguarde.', '/settings?tab=profile');
  END IF;

  RETURN true;
END;
$$;

-- 13. Helper function to get signed URL for admin review (to be called from Edge Function)
-- This is a placeholder - actual signed URL generation happens in Edge Function
CREATE OR REPLACE FUNCTION public.get_identity_files_for_review(
  p_verification_id uuid
)
RETURNS TABLE (
  file_id uuid,
  file_type text,
  storage_path text,
  quality_score numeric,
  quality_issues text[],
  created_at timestamptz
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
    ivf.id,
    ivf.file_type,
    ivf.storage_path,
    ivf.quality_score,
    ivf.quality_issues,
    ivf.created_at
  FROM identity_verification_files ivf
  WHERE ivf.identity_verification_id = p_verification_id
  ORDER BY 
    CASE ivf.file_type 
      WHEN 'document_front' THEN 1 
      WHEN 'document_back' THEN 2 
      WHEN 'selfie' THEN 3 
    END;
END;
$$;

-- 14. Admin view for pending verifications
CREATE OR REPLACE VIEW public.identity_verifications_admin AS
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
  (SELECT COUNT(*) FROM identity_verification_files ivf WHERE ivf.identity_verification_id = iv.id) as files_count
FROM identity_verifications iv
LEFT JOIN profiles p ON p.user_id = iv.user_id
LEFT JOIN freelancer_profiles fp ON fp.user_id = iv.user_id AND iv.subject_type = 'freelancer'
LEFT JOIN company_profiles cp ON cp.user_id = iv.user_id AND iv.subject_type = 'company';

-- Grant access to admin view (handled by is_admin() in RPC)
