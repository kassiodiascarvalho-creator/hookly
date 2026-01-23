-- ================================================================================
-- FINANCIAL IDEMPOTENCY & CONSISTENCY FIX
-- Date: 2026-01-23
-- 
-- This migration fixes 3 critical RPCs with:
-- - Strong idempotency using advisory locks and ledger checks
-- - Atomic balance updates with guards against negative balances
-- - Backward compatible signatures
-- - Uses ONLY existing columns from schema
-- ================================================================================

-- ================================================================================
-- 1) release_escrow_to_earnings
-- ================================================================================
-- Signature (backward compatible + new optional param):
--   p_company_user_id uuid
--   p_freelancer_user_id uuid
--   p_contract_id uuid
--   p_amount numeric
--   p_context text DEFAULT 'milestone_approved'
--   p_payment_id uuid DEFAULT NULL  <-- NEW (optional, for legacy payment idempotency)
-- ================================================================================

CREATE OR REPLACE FUNCTION public.release_escrow_to_earnings(
  p_company_user_id uuid,
  p_freelancer_user_id uuid,
  p_contract_id uuid,
  p_amount numeric,
  p_context text DEFAULT 'milestone_approved',
  p_payment_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_escrow numeric;
  v_freelancer_earnings numeric;
  v_currency text;
  v_lock_acquired boolean := FALSE;
BEGIN
  -- =========================================================================
  -- VALIDATION: Amount must be positive
  -- =========================================================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive, got: %', p_amount;
  END IF;

  -- =========================================================================
  -- ENSURE BALANCES EXIST (for both parties)
  -- =========================================================================
  PERFORM ensure_user_balance(p_company_user_id, 'company');
  PERFORM ensure_user_balance(p_freelancer_user_id, 'freelancer');

  -- =========================================================================
  -- IDEMPOTENCY: Lock and check for duplicate (only if p_payment_id provided)
  -- =========================================================================
  IF p_payment_id IS NOT NULL THEN
    -- Advisory lock prevents concurrent execution for same payment
    PERFORM pg_advisory_xact_lock(hashtext(p_payment_id::text)::bigint);
    v_lock_acquired := TRUE;
    
    -- Check if already processed (by legacy_payment_id in metadata)
    IF EXISTS (
      SELECT 1 FROM ledger_transactions 
      WHERE tx_type = 'escrow_release' 
      AND metadata->>'legacy_payment_id' = p_payment_id::text
      LIMIT 1
    ) THEN
      -- Already processed - idempotent return
      RETURN TRUE;
    END IF;
  END IF;

  -- =========================================================================
  -- GET CURRENCY (from company balance, fallback to freelancer, then BRL)
  -- =========================================================================
  SELECT currency INTO v_currency
  FROM user_balances 
  WHERE user_id = p_company_user_id AND user_type = 'company';
  
  IF v_currency IS NULL THEN
    SELECT currency INTO v_currency
    FROM user_balances 
    WHERE user_id = p_freelancer_user_id AND user_type = 'freelancer';
  END IF;
  
  v_currency := COALESCE(v_currency, 'BRL');

  -- =========================================================================
  -- ATOMIC DEBIT: Company escrow (with guard against negative)
  -- =========================================================================
  UPDATE user_balances
  SET 
    escrow_held = escrow_held - p_amount,
    updated_at = now()
  WHERE user_id = p_company_user_id 
    AND user_type = 'company' 
    AND escrow_held >= p_amount
  RETURNING escrow_held INTO v_company_escrow;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient escrow balance for company %. Required: %, Available: (check user_balances)', 
      p_company_user_id, p_amount;
  END IF;

  -- =========================================================================
  -- ATOMIC CREDIT: Freelancer earnings
  -- =========================================================================
  UPDATE user_balances
  SET 
    earnings_available = earnings_available + p_amount,
    updated_at = now()
  WHERE user_id = p_freelancer_user_id 
    AND user_type = 'freelancer'
  RETURNING earnings_available INTO v_freelancer_earnings;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to credit freelancer balance for user %', p_freelancer_user_id;
  END IF;

  -- =========================================================================
  -- LEDGER: Insert 2 entries (company debit + freelancer credit)
  -- Using ONLY existing columns from schema
  -- =========================================================================
  
  -- Company ledger entry (escrow release - debit)
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    related_contract_id,
    balance_after_escrow,
    metadata
  ) VALUES (
    p_company_user_id,
    'escrow_release',
    -p_amount,  -- Negative for debit
    v_currency,
    p_context,
    p_contract_id,
    v_company_escrow,
    CASE 
      WHEN p_payment_id IS NOT NULL THEN jsonb_build_object('legacy_payment_id', p_payment_id::text)
      ELSE '{}'::jsonb
    END
  );

  -- Freelancer ledger entry (escrow release - credit)
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    related_contract_id,
    balance_after_earnings,
    metadata
  ) VALUES (
    p_freelancer_user_id,
    'escrow_release',
    p_amount,  -- Positive for credit
    v_currency,
    p_context,
    p_contract_id,
    v_freelancer_earnings,
    CASE 
      WHEN p_payment_id IS NOT NULL THEN jsonb_build_object('legacy_payment_id', p_payment_id::text)
      ELSE '{}'::jsonb
    END
  );

  RETURN TRUE;
END;
$$;

-- ================================================================================
-- 2) request_withdrawal
-- ================================================================================
-- Signature (UNCHANGED - backward compatible):
--   p_freelancer_user_id uuid
--   p_amount numeric
--   p_payout_method_id uuid
-- Returns: uuid (withdrawal_request id)
-- ================================================================================

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_freelancer_user_id uuid,
  p_amount numeric,
  p_payout_method_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_earnings numeric;
  v_currency text;
  v_withdrawal_id uuid;
  v_payout_details jsonb;
BEGIN
  -- =========================================================================
  -- VALIDATION: Amount must be positive
  -- =========================================================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive, got: %', p_amount;
  END IF;

  -- =========================================================================
  -- ENSURE BALANCE EXISTS
  -- =========================================================================
  PERFORM ensure_user_balance(p_freelancer_user_id, 'freelancer');

  -- =========================================================================
  -- VALIDATE PAYOUT METHOD OWNERSHIP (using freelancer_user_id column)
  -- =========================================================================
  IF NOT EXISTS (
    SELECT 1 FROM payout_methods 
    WHERE id = p_payout_method_id 
    AND freelancer_user_id = p_freelancer_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid payout method or not owned by this freelancer';
  END IF;

  -- =========================================================================
  -- GET PAYOUT DETAILS (for snapshot in withdrawal request)
  -- =========================================================================
  SELECT jsonb_build_object(
    'type', type,
    'pix_key', pix_key,
    'pix_key_type', pix_key_type,
    'bank_name', bank_name,
    'bank_code', bank_code,
    'branch', branch,
    'account', account,
    'account_type', account_type,
    'holder_name', holder_name
  ) INTO v_payout_details
  FROM payout_methods
  WHERE id = p_payout_method_id;

  -- =========================================================================
  -- GET CURRENCY (from freelancer balance with fallback)
  -- =========================================================================
  SELECT currency INTO v_currency
  FROM user_balances 
  WHERE user_id = p_freelancer_user_id AND user_type = 'freelancer';
  
  v_currency := COALESCE(v_currency, 'BRL');

  -- =========================================================================
  -- ATOMIC DEBIT: Freelancer earnings (anti-race condition)
  -- =========================================================================
  UPDATE user_balances
  SET 
    earnings_available = earnings_available - p_amount,
    updated_at = now()
  WHERE user_id = p_freelancer_user_id 
    AND user_type = 'freelancer' 
    AND earnings_available >= p_amount
  RETURNING earnings_available INTO v_new_earnings;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient earnings balance. Required: %, check your available balance', p_amount;
  END IF;

  -- =========================================================================
  -- CREATE WITHDRAWAL REQUEST
  -- Using ONLY existing columns from schema
  -- =========================================================================
  INSERT INTO withdrawal_requests (
    freelancer_user_id,
    amount,
    currency,
    status,
    payout_method_id,
    payout_details
    -- created_at and updated_at have defaults
  ) VALUES (
    p_freelancer_user_id,
    p_amount,
    v_currency,
    'pending_review',
    p_payout_method_id,
    v_payout_details
  )
  RETURNING id INTO v_withdrawal_id;

  -- =========================================================================
  -- LEDGER: Record withdrawal request
  -- =========================================================================
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    related_withdrawal_id,
    balance_after_earnings,
    metadata
  ) VALUES (
    p_freelancer_user_id,
    'withdrawal_request',
    -p_amount,  -- Negative (funds reserved)
    v_currency,
    'withdrawal_request',
    v_withdrawal_id,
    v_new_earnings,
    '{}'::jsonb
  );

  RETURN v_withdrawal_id;
END;
$$;

-- ================================================================================
-- 3) process_withdrawal
-- ================================================================================
-- Signature (UNCHANGED - backward compatible):
--   p_withdrawal_id uuid
--   p_new_status withdrawal_status
--   p_admin_id uuid
--   p_admin_notes text DEFAULT NULL
-- Returns: boolean
-- ================================================================================

CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id uuid,
  p_new_status withdrawal_status,
  p_admin_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status withdrawal_status;
  v_freelancer_user_id uuid;
  v_amount numeric;
  v_currency text;
  v_new_earnings numeric;
BEGIN
  -- =========================================================================
  -- LOCK AND FETCH: Get current withdrawal state (FOR UPDATE prevents races)
  -- =========================================================================
  SELECT status, freelancer_user_id, amount, currency
  INTO v_current_status, v_freelancer_user_id, v_amount, v_currency
  FROM withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found: %', p_withdrawal_id;
  END IF;

  -- =========================================================================
  -- IDEMPOTENCY: If already in target status, return success
  -- =========================================================================
  IF v_current_status = p_new_status THEN
    RETURN TRUE;
  END IF;

  -- =========================================================================
  -- STATE MACHINE: Validate transitions
  -- pending_review -> approved | rejected
  -- approved -> paid | rejected
  -- paid -> (terminal)
  -- rejected -> (terminal)
  -- =========================================================================
  IF v_current_status = 'pending_review' THEN
    IF p_new_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Invalid transition from pending_review to %', p_new_status;
    END IF;
  ELSIF v_current_status = 'approved' THEN
    IF p_new_status NOT IN ('paid', 'rejected') THEN
      RAISE EXCEPTION 'Invalid transition from approved to %', p_new_status;
    END IF;
  ELSIF v_current_status IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Cannot transition from terminal status %', v_current_status;
  ELSE
    RAISE EXCEPTION 'Unknown current status: %', v_current_status;
  END IF;

  -- =========================================================================
  -- HANDLE REJECTION: Refund funds to freelancer
  -- =========================================================================
  IF p_new_status = 'rejected' THEN
    -- Check if refund already exists (idempotency)
    IF NOT EXISTS (
      SELECT 1 FROM ledger_transactions 
      WHERE related_withdrawal_id = p_withdrawal_id 
      AND tx_type = 'refund'
      LIMIT 1
    ) THEN
      -- Refund to freelancer balance
      UPDATE user_balances
      SET 
        earnings_available = earnings_available + v_amount,
        updated_at = now()
      WHERE user_id = v_freelancer_user_id 
        AND user_type = 'freelancer'
      RETURNING earnings_available INTO v_new_earnings;

      -- Record refund in ledger
      INSERT INTO ledger_transactions (
        user_id,
        tx_type,
        amount,
        currency,
        context,
        related_withdrawal_id,
        balance_after_earnings,
        metadata
      ) VALUES (
        v_freelancer_user_id,
        'refund',
        v_amount,  -- Positive (funds returned)
        v_currency,
        'withdrawal_rejected',
        p_withdrawal_id,
        v_new_earnings,
        jsonb_build_object('admin_id', p_admin_id::text, 'notes', COALESCE(p_admin_notes, ''))
      );
    END IF;

    -- Update withdrawal request status
    UPDATE withdrawal_requests
    SET 
      status = 'rejected',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
    WHERE id = p_withdrawal_id;

  -- =========================================================================
  -- HANDLE APPROVAL: Just update status (no balance change)
  -- =========================================================================
  ELSIF p_new_status = 'approved' THEN
    UPDATE withdrawal_requests
    SET 
      status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
    WHERE id = p_withdrawal_id;

  -- =========================================================================
  -- HANDLE PAID: Record completion (balance already debited in request)
  -- =========================================================================
  ELSIF p_new_status = 'paid' THEN
    -- Check if already recorded (idempotency)
    IF NOT EXISTS (
      SELECT 1 FROM ledger_transactions 
      WHERE related_withdrawal_id = p_withdrawal_id 
      AND tx_type = 'withdrawal_paid'
      LIMIT 1
    ) THEN
      -- Record paid in ledger (no balance change - already debited)
      INSERT INTO ledger_transactions (
        user_id,
        tx_type,
        amount,
        currency,
        context,
        related_withdrawal_id,
        metadata
      ) VALUES (
        v_freelancer_user_id,
        'withdrawal_paid',
        -v_amount,  -- Negative (informational - funds left the system)
        v_currency,
        'withdrawal_completed',
        p_withdrawal_id,
        jsonb_build_object('admin_id', p_admin_id::text, 'notes', COALESCE(p_admin_notes, ''))
      );
    END IF;

    -- Update withdrawal request status
    UPDATE withdrawal_requests
    SET 
      status = 'paid',
      paid_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
    WHERE id = p_withdrawal_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- ================================================================================
-- OPTIONAL INDEXES (for performance, not unique - advisory lock handles races)
-- ================================================================================

-- Index for ledger lookups by withdrawal
CREATE INDEX IF NOT EXISTS idx_ledger_withdrawal_tx_type 
ON ledger_transactions (related_withdrawal_id, tx_type) 
WHERE related_withdrawal_id IS NOT NULL;

-- Index for ledger lookups by contract
CREATE INDEX IF NOT EXISTS idx_ledger_contract_tx_type 
ON ledger_transactions (related_contract_id, tx_type) 
WHERE related_contract_id IS NOT NULL;

-- GIN index for metadata JSONB (for legacy_payment_id lookups)
CREATE INDEX IF NOT EXISTS idx_ledger_metadata_gin 
ON ledger_transactions USING gin (metadata jsonb_path_ops);

-- ================================================================================
-- END OF MIGRATION
-- ================================================================================
