-- =============================================
-- IDENTITY VERIFICATION (KYC) SYSTEM
-- Provider: Stripe Identity
-- =============================================

-- 1. Main identity verifications table
CREATE TABLE IF NOT EXISTS public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('freelancer', 'company')),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'pending', 'processing', 'verified', 'failed_soft', 'failed_hard', 'manual_review', 'rejected')),
  country text NOT NULL DEFAULT 'BR',
  document_type text NOT NULL CHECK (document_type IN ('cnh', 'rg', 'passport', 'national_id', 'drivers_license', 'residence_permit')),
  provider text NOT NULL DEFAULT 'stripe_identity',
  provider_session_id text UNIQUE,
  provider_report_id text,
  verification_score numeric,
  risk_level text CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high', 'hard')),
  failure_reason text,
  failure_code text,
  attempts integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 2,
  consent_given boolean NOT NULL DEFAULT false,
  consent_given_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  reviewed_by_admin_id uuid,
  admin_decision text CHECK (admin_decision IS NULL OR admin_decision IN ('approved', 'rejected')),
  admin_notes text,
  admin_decision_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Identity audit logs for compliance
CREATE TABLE IF NOT EXISTS public.identity_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_verification_id uuid REFERENCES public.identity_verifications(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'admin', 'system', 'webhook')),
  action text NOT NULL,
  previous_status text,
  new_status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add identity status columns to profiles (freelancer and company)
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS identity_status text DEFAULT 'not_started' CHECK (identity_status IN ('not_started', 'pending', 'processing', 'verified', 'failed_soft', 'failed_hard', 'manual_review', 'rejected')),
ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS identity_status text DEFAULT 'not_started' CHECK (identity_status IN ('not_started', 'pending', 'processing', 'verified', 'failed_soft', 'failed_hard', 'manual_review', 'rejected')),
ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id ON public.identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON public.identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_provider_session ON public.identity_verifications(provider_session_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_logs_verification_id ON public.identity_audit_logs(identity_verification_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_identity_status ON public.freelancer_profiles(identity_status);
CREATE INDEX IF NOT EXISTS idx_company_profiles_identity_status ON public.company_profiles(identity_status);

-- 5. Enable RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for identity_verifications
CREATE POLICY "Users can view own identity verifications" ON public.identity_verifications
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "No direct identity_verifications inserts" ON public.identity_verifications
  FOR INSERT WITH CHECK (false);

CREATE POLICY "No direct identity_verifications updates" ON public.identity_verifications
  FOR UPDATE USING (false);

-- 7. RLS Policies for identity_audit_logs
CREATE POLICY "Users can view own audit logs" ON public.identity_audit_logs
  FOR SELECT USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM public.identity_verifications iv 
      WHERE iv.id = identity_verification_id AND iv.user_id = auth.uid()
    )
  );

CREATE POLICY "No direct audit log inserts" ON public.identity_audit_logs
  FOR INSERT WITH CHECK (false);

-- 8. Helper function to get current identity status
CREATE OR REPLACE FUNCTION public.get_identity_status(p_user_id uuid, p_subject_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
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
      'can_start_verification', true,
      'attempts', 0,
      'max_attempts', 2
    );
  END IF;

  RETURN jsonb_build_object(
    'status', v_verification.status,
    'verification_id', v_verification.id,
    'country', v_verification.country,
    'document_type', v_verification.document_type,
    'attempts', v_verification.attempts,
    'max_attempts', v_verification.max_attempts,
    'can_start_verification', (
      v_verification.status IN ('not_started', 'failed_soft') 
      AND v_verification.attempts < v_verification.max_attempts
    ),
    'verified_at', v_verification.verified_at,
    'failure_reason', v_verification.failure_reason,
    'created_at', v_verification.created_at
  );
END;
$$;

-- 9. Function to create identity session (called from Edge Function)
CREATE OR REPLACE FUNCTION public.create_identity_session(
  p_user_id uuid,
  p_subject_type text,
  p_country text,
  p_document_type text,
  p_provider_session_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification_id uuid;
  v_existing RECORD;
  v_new_attempts integer;
BEGIN
  SELECT * INTO v_existing
  FROM identity_verifications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'verified' THEN
      RAISE EXCEPTION 'User already verified';
    END IF;
    IF v_existing.status IN ('manual_review', 'rejected') AND v_existing.admin_decision IS NULL THEN
      RAISE EXCEPTION 'Verification blocked - awaiting admin review';
    END IF;
    IF v_existing.status NOT IN ('not_started', 'failed_soft') AND v_existing.attempts >= v_existing.max_attempts THEN
      RAISE EXCEPTION 'Maximum verification attempts reached';
    END IF;
    v_new_attempts := v_existing.attempts + 1;
  ELSE
    v_new_attempts := 1;
  END IF;

  INSERT INTO identity_verifications (
    user_id,
    subject_type,
    status,
    country,
    document_type,
    provider_session_id,
    attempts,
    consent_given,
    consent_given_at
  ) VALUES (
    p_user_id,
    p_subject_type,
    'pending',
    p_country,
    p_document_type,
    p_provider_session_id,
    v_new_attempts,
    true,
    now()
  )
  RETURNING id INTO v_verification_id;

  IF p_subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles SET identity_status = 'pending' WHERE user_id = p_user_id;
  ELSE
    UPDATE company_profiles SET identity_status = 'pending' WHERE user_id = p_user_id;
  END IF;

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
    'session_created',
    'pending',
    jsonb_build_object('country', p_country, 'document_type', p_document_type, 'attempt', v_new_attempts)
  );

  RETURN v_verification_id;
END;
$$;

-- 10. Function to update verification from webhook
CREATE OR REPLACE FUNCTION public.update_identity_from_webhook(
  p_provider_session_id text,
  p_status text,
  p_report_id text DEFAULT NULL,
  p_score numeric DEFAULT NULL,
  p_risk_level text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_failure_code text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_new_status text;
  v_profile_status text;
BEGIN
  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE provider_session_id = p_provider_session_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found for session: %', p_provider_session_id;
  END IF;

  v_new_status := CASE
    WHEN p_status = 'verified' THEN 'verified'
    WHEN p_status = 'requires_input' THEN 'failed_soft'
    WHEN p_status = 'canceled' THEN 'failed_soft'
    WHEN p_risk_level = 'hard' THEN 'manual_review'
    WHEN p_risk_level = 'high' AND p_score IS NOT NULL AND p_score < 0.5 THEN 'manual_review'
    WHEN p_status = 'processing' THEN 'processing'
    ELSE 'failed_soft'
  END;

  IF v_new_status = 'failed_soft' AND v_verification.attempts >= v_verification.max_attempts THEN
    v_new_status := 'manual_review';
  END IF;

  v_profile_status := v_new_status;

  UPDATE identity_verifications
  SET 
    status = v_new_status,
    provider_report_id = COALESCE(p_report_id, provider_report_id),
    verification_score = COALESCE(p_score, verification_score),
    risk_level = COALESCE(p_risk_level, risk_level),
    failure_reason = COALESCE(p_failure_reason, failure_reason),
    failure_code = COALESCE(p_failure_code, failure_code),
    metadata = metadata || p_metadata,
    verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE verified_at END,
    updated_at = now()
  WHERE id = v_verification.id;

  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles 
    SET 
      identity_status = v_profile_status,
      identity_verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE identity_verified_at END
    WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles 
    SET 
      identity_status = v_profile_status,
      identity_verified_at = CASE WHEN v_new_status = 'verified' THEN now() ELSE identity_verified_at END
    WHERE user_id = v_verification.user_id;
  END IF;

  INSERT INTO identity_audit_logs (
    identity_verification_id,
    actor_type,
    action,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    v_verification.id,
    'webhook',
    'status_updated',
    v_verification.status,
    v_new_status,
    jsonb_build_object('report_id', p_report_id, 'score', p_score, 'risk_level', p_risk_level)
  );

  IF v_new_status = 'verified' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '✅ Sua identidade foi verificada com sucesso!', '/settings?tab=profile');
  ELSIF v_new_status = 'failed_soft' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '⚠️ Houve um problema com sua verificação. Tente novamente.', '/settings?tab=profile');
  ELSIF v_new_status = 'manual_review' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '🔍 Sua verificação está em análise manual. Aguarde.', '/settings?tab=profile');
  END IF;

  RETURN true;
END;
$$;

-- 11. Admin function to approve/reject verification
CREATE OR REPLACE FUNCTION public.admin_review_identity(
  p_verification_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_verification RECORD;
  v_new_status text;
  v_admin_id uuid;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_verification
  FROM identity_verifications
  WHERE id = p_verification_id;

  IF v_verification IS NULL THEN
    RAISE EXCEPTION 'Verification not found';
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  v_new_status := CASE WHEN p_decision = 'approved' THEN 'verified' ELSE 'rejected' END;

  UPDATE identity_verifications
  SET 
    status = v_new_status,
    admin_decision = p_decision,
    admin_notes = p_notes,
    reviewed_by_admin_id = v_admin_id,
    admin_decision_at = now(),
    verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE verified_at END,
    updated_at = now()
  WHERE id = p_verification_id;

  IF v_verification.subject_type = 'freelancer' THEN
    UPDATE freelancer_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE identity_verified_at END
    WHERE user_id = v_verification.user_id;
  ELSE
    UPDATE company_profiles 
    SET 
      identity_status = v_new_status,
      identity_verified_at = CASE WHEN p_decision = 'approved' THEN now() ELSE identity_verified_at END
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

  IF p_decision = 'approved' THEN
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '✅ Sua identidade foi aprovada pelo nosso time!', '/settings?tab=profile');
  ELSE
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (v_verification.user_id, 'verification', '❌ Sua verificação de identidade foi recusada. Entre em contato para mais informações.', '/settings?tab=profile');
  END IF;

  RETURN true;
END;
$$;

-- 12. Admin function to reset verification (allow new attempt)
CREATE OR REPLACE FUNCTION public.admin_reset_identity_verification(
  p_verification_id uuid,
  p_notes text DEFAULT NULL
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
  v_admin_id := auth.uid();
  
  IF NOT is_admin() THEN
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

  INSERT INTO notifications (user_id, type, message, link)
  VALUES (v_verification.user_id, 'verification', '🔄 Sua verificação foi liberada para nova tentativa.', '/settings?tab=profile');

  RETURN true;
END;
$$;

-- 13. Enable realtime for identity status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.identity_verifications;
