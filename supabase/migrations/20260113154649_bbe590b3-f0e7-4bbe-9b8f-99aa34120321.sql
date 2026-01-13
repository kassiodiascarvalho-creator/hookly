-- Update process_withdrawal to ensure minor units are used consistently
CREATE OR REPLACE FUNCTION public.process_withdrawal(p_withdrawal_id uuid, p_new_status withdrawal_status, p_admin_id uuid, p_admin_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_withdrawal RECORD;
  v_new_earnings NUMERIC;
BEGIN
  -- Get withdrawal (amount is now in minor units)
  SELECT * INTO v_withdrawal 
  FROM withdrawal_requests 
  WHERE id = p_withdrawal_id;
  
  IF v_withdrawal IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdrawal_requests
  SET status = p_new_status,
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      updated_at = now()
  WHERE id = p_withdrawal_id;
  
  -- If rejected, return funds to earnings (all in minor units)
  IF p_new_status = 'rejected' THEN
    UPDATE user_balances 
    SET earnings_available = earnings_available + v_withdrawal.amount,
        updated_at = now()
    WHERE user_id = v_withdrawal.freelancer_user_id
    RETURNING earnings_available INTO v_new_earnings;
    
    -- Record refund transaction (amount in minor units)
    INSERT INTO ledger_transactions (
      user_id, tx_type, amount, currency,
      context, related_withdrawal_id,
      balance_after_earnings
    )
    VALUES (
      v_withdrawal.freelancer_user_id, 'refund', v_withdrawal.amount, v_withdrawal.currency,
      'withdrawal_rejected', p_withdrawal_id,
      v_new_earnings
    );
  END IF;
  
  -- If paid, record final transaction (amount in minor units)
  IF p_new_status = 'paid' THEN
    INSERT INTO ledger_transactions (
      user_id, tx_type, amount, currency,
      context, related_withdrawal_id,
      metadata
    )
    VALUES (
      v_withdrawal.freelancer_user_id, 'withdrawal_paid', -v_withdrawal.amount, v_withdrawal.currency,
      'withdrawal_completed', p_withdrawal_id,
      jsonb_build_object('admin_id', p_admin_id)
    );
  END IF;
  
  RETURN TRUE;
END;
$function$;