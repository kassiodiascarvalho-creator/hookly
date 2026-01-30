-- ================================================================================
-- SECURITY HARDENING: Set search_path on all custom functions
-- Date: 2026-01-30
-- Fixes: Function search path mutable vulnerability
-- ================================================================================

-- Fix is_admin function
ALTER FUNCTION public.is_admin() SET search_path TO 'public';

-- Fix has_role function (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE 'ALTER FUNCTION public.has_role(uuid, app_role) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix ensure_user_balance function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ensure_user_balance') THEN
    EXECUTE 'ALTER FUNCTION public.ensure_user_balance(uuid, text) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix release_escrow_to_earnings function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_escrow_to_earnings') THEN
    EXECUTE 'ALTER FUNCTION public.release_escrow_to_earnings(uuid, uuid, uuid, numeric, text, uuid) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix request_withdrawal function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'request_withdrawal') THEN
    EXECUTE 'ALTER FUNCTION public.request_withdrawal(uuid, numeric, uuid) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix process_withdrawal function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_withdrawal') THEN
    EXECUTE 'ALTER FUNCTION public.process_withdrawal(uuid, withdrawal_status, uuid, text) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix spend_platform_credits function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spend_platform_credits') THEN
    EXECUTE 'ALTER FUNCTION public.spend_platform_credits(uuid, text, integer, text, text, uuid) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix add_platform_credits function (multiple overloads)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'add_platform_credits') THEN
    -- This may fail for some overloads, which is fine
    BEGIN
      EXECUTE 'ALTER FUNCTION public.add_platform_credits(uuid, text, integer, text, text, uuid, text) SET search_path TO ''public''';
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if this overload doesn't exist
    END;
  END IF;
END $$;

-- Fix check_and_grant_plan_credits function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_and_grant_plan_credits') THEN
    EXECUTE 'ALTER FUNCTION public.check_and_grant_plan_credits(uuid, text, text, text, integer, date, integer) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix grant_profile_completion_bonus function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_profile_completion_bonus') THEN
    EXECUTE 'ALTER FUNCTION public.grant_profile_completion_bonus(uuid) SET search_path TO ''public''';
  END IF;
END $$;

-- Fix admin_adjust_user_balance function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_adjust_user_balance') THEN
    EXECUTE 'ALTER FUNCTION public.admin_adjust_user_balance(uuid, text, numeric, text, text, text) SET search_path TO ''public''';
  END IF;
END $$;

-- ================================================================================
-- END OF MIGRATION
-- ================================================================================
