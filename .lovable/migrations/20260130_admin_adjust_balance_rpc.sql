-- RPC function for admins to adjust user balances
CREATE OR REPLACE FUNCTION public.admin_adjust_user_balance(
  p_user_id uuid,
  p_currency text,
  p_earnings_available numeric,
  p_reason text DEFAULT 'Admin adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance numeric;
  v_old_currency text;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin access required';
  END IF;

  -- Get current balance info
  SELECT earnings_available, currency INTO v_old_balance, v_old_currency
  FROM user_balances
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Insert new record if doesn't exist
    INSERT INTO user_balances (user_id, user_type, currency, earnings_available, escrow_held, credits_available)
    VALUES (p_user_id, 'freelancer', p_currency, p_earnings_available, 0, 0);
    
    v_old_balance := 0;
    v_old_currency := 'USD';
  ELSE
    -- Update existing record
    UPDATE user_balances
    SET 
      currency = p_currency,
      earnings_available = p_earnings_available,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Log the adjustment in ledger_transactions
  INSERT INTO ledger_transactions (
    user_id,
    tx_type,
    amount,
    currency,
    context,
    metadata
  ) VALUES (
    p_user_id,
    'admin_adjustment',
    p_earnings_available - COALESCE(v_old_balance, 0),
    p_currency,
    p_reason,
    jsonb_build_object(
      'old_balance', v_old_balance,
      'old_currency', v_old_currency,
      'new_balance', p_earnings_available,
      'new_currency', p_currency,
      'adjusted_by', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_balance', v_old_balance,
    'old_currency', v_old_currency,
    'new_balance', p_earnings_available,
    'new_currency', p_currency
  );
END;
$$;

-- Add admin_adjustment to ledger_tx_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'admin_adjustment' 
    AND enumtypid = 'ledger_tx_type'::regtype
  ) THEN
    ALTER TYPE ledger_tx_type ADD VALUE 'admin_adjustment';
  END IF;
END $$;
