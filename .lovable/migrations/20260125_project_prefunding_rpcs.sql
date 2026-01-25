-- Migration: Project Prefunding RPCs
-- Purpose: Add functions for prefunding projects at publish time

-- Add project_prefund to the enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'project_prefund' 
    AND enumtypid = 'ledger_tx_type'::regtype
  ) THEN
    ALTER TYPE ledger_tx_type ADD VALUE 'project_prefund';
  END IF;
END
$$;

-- Create fund_project_escrow RPC with idempotency
CREATE OR REPLACE FUNCTION public.fund_project_escrow(
  p_company_user_id UUID,
  p_project_id UUID,
  p_amount NUMERIC,
  p_unified_payment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lock_id BIGINT;
  v_existing_tx UUID;
  v_new_escrow NUMERIC;
  v_current_escrow NUMERIC;
BEGIN
  -- Generate a stable lock ID from the payment UUID
  v_lock_id := ('x' || substr(p_unified_payment_id::text, 1, 8))::bit(32)::bigint;
  
  -- Acquire advisory lock for idempotency
  PERFORM pg_advisory_xact_lock(v_lock_id);
  
  -- Check for existing transaction with this payment_id (idempotency check)
  SELECT id INTO v_existing_tx
  FROM ledger_transactions
  WHERE related_payment_id = p_unified_payment_id
    AND tx_type = 'project_prefund'
  LIMIT 1;
  
  IF v_existing_tx IS NOT NULL THEN
    -- Already processed, return true (idempotent success)
    RETURN TRUE;
  END IF;
  
  -- Ensure user balance record exists
  PERFORM ensure_user_balance(p_company_user_id, 'company');
  
  -- Get current escrow balance
  SELECT escrow_held INTO v_current_escrow
  FROM user_balances
  WHERE user_id = p_company_user_id
    AND user_type = 'company'
  FOR UPDATE;
  
  -- Calculate new escrow balance
  v_new_escrow := COALESCE(v_current_escrow, 0) + p_amount;
  
  -- Update escrow_held
  UPDATE user_balances
  SET 
    escrow_held = v_new_escrow,
    updated_at = NOW()
  WHERE user_id = p_company_user_id
    AND user_type = 'company';
  
  -- Insert ledger transaction with project metadata
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    related_payment_id,
    balance_after_escrow,
    metadata
  ) VALUES (
    p_company_user_id,
    'project_prefund',
    p_amount,
    'USD',
    'project_prefund',
    p_unified_payment_id,
    v_new_escrow,
    jsonb_build_object(
      'purpose', 'project_prefund',
      'project_id', p_project_id,
      'unified_payment_id', p_unified_payment_id
    )
  );
  
  RETURN TRUE;
END;
$$;

-- Create function to get project prefund amount
CREATE OR REPLACE FUNCTION public.get_project_prefund_amount(
  p_project_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM ledger_transactions
  WHERE tx_type = 'project_prefund'
    AND metadata->>'project_id' = p_project_id::text;
  
  RETURN v_total;
END;
$$;

-- Create function to apply project prefund to a contract
CREATE OR REPLACE FUNCTION public.apply_project_prefund_to_contract(
  p_project_id UUID,
  p_contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefund_amount NUMERIC;
  v_contract_amount NUMERIC;
  v_company_user_id UUID;
  v_existing_application UUID;
BEGIN
  -- Check if already applied (idempotency)
  SELECT id INTO v_existing_application
  FROM ledger_transactions
  WHERE related_contract_id = p_contract_id
    AND context = 'prefund_applied'
  LIMIT 1;
  
  IF v_existing_application IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Get prefund amount for this project
  v_prefund_amount := get_project_prefund_amount(p_project_id);
  
  IF v_prefund_amount <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Get contract info
  SELECT amount_cents / 100.0, company_user_id 
  INTO v_contract_amount, v_company_user_id
  FROM contracts
  WHERE id = p_contract_id
    AND project_id = p_project_id;
  
  IF v_company_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Insert a ledger record linking prefund to contract
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    related_contract_id,
    metadata
  ) VALUES (
    v_company_user_id,
    'contract_funding',
    LEAST(v_prefund_amount, v_contract_amount),
    'USD',
    'prefund_applied',
    p_contract_id,
    jsonb_build_object(
      'source', 'project_prefund',
      'project_id', p_project_id,
      'prefund_amount', v_prefund_amount,
      'contract_amount', v_contract_amount
    )
  );
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.fund_project_escrow TO service_role;
GRANT EXECUTE ON FUNCTION public.fund_project_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_prefund_amount TO service_role;
GRANT EXECUTE ON FUNCTION public.get_project_prefund_amount TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_project_prefund_to_contract TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_project_prefund_to_contract TO authenticated;
