CREATE OR REPLACE FUNCTION public.request_withdrawal(p_freelancer_user_id uuid, p_amount numeric, p_payout_method_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_earnings NUMERIC;
  v_new_earnings NUMERIC;
  v_withdrawal_id UUID;
  v_payout_details JSONB;
  v_currency TEXT;
BEGIN
  -- Get current earnings
  SELECT earnings_available INTO v_current_earnings 
  FROM user_balances 
  WHERE user_id = p_freelancer_user_id;
  
  IF v_current_earnings IS NULL OR v_current_earnings < p_amount THEN
    RAISE EXCEPTION 'Insufficient earnings balance';
  END IF;
  
  -- Get payout method details
  SELECT jsonb_build_object(
    'type', type,
    'pix_key', pix_key,
    'pix_key_type', pix_key_type,
    'bank_name', bank_name,
    'branch', branch,
    'account', account,
    'holder_name', holder_name
  ) INTO v_payout_details
  FROM payout_methods
  WHERE id = p_payout_method_id AND freelancer_user_id = p_freelancer_user_id;
  
  IF v_payout_details IS NULL THEN
    RAISE EXCEPTION 'Invalid payout method';
  END IF;
  
  -- Get preferred payout currency from freelancer profile, fallback to user_balances currency, then to BRL
  SELECT COALESCE(fp.preferred_payout_currency, ub.currency, 'BRL') INTO v_currency
  FROM freelancer_profiles fp
  LEFT JOIN user_balances ub ON ub.user_id = fp.user_id AND ub.user_type = 'freelancer'
  WHERE fp.user_id = p_freelancer_user_id;
  
  IF v_currency IS NULL THEN
    v_currency := 'BRL';
  END IF;
  
  -- Hold earnings (subtract from available)
  UPDATE user_balances 
  SET earnings_available = earnings_available - p_amount,
      updated_at = now()
  WHERE user_id = p_freelancer_user_id
  RETURNING earnings_available INTO v_new_earnings;
  
  -- Create withdrawal request with correct currency
  INSERT INTO withdrawal_requests (
    freelancer_user_id, amount, currency,
    payout_method_id, payout_details, status
  )
  VALUES (
    p_freelancer_user_id, p_amount, v_currency,
    p_payout_method_id, v_payout_details, 'pending_review'
  )
  RETURNING id INTO v_withdrawal_id;
  
  -- Record transaction with correct currency
  INSERT INTO ledger_transactions (
    user_id, tx_type, amount, currency,
    context, related_withdrawal_id,
    balance_after_earnings
  )
  VALUES (
    p_freelancer_user_id, 'withdrawal_request', -p_amount, v_currency,
    'withdrawal_requested', v_withdrawal_id,
    v_new_earnings
  );
  
  RETURN v_withdrawal_id;
END;
$function$;