-- Update function to read bonus value from platform_action_costs
CREATE OR REPLACE FUNCTION public.grant_profile_completion_bonus(p_user_id uuid, p_user_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_already_claimed BOOLEAN;
  v_bonus_credits INTEGER;
  v_is_enabled BOOLEAN;
BEGIN
  -- Check if already claimed
  SELECT profile_completion_bonus_claimed INTO v_already_claimed
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_already_claimed = TRUE THEN
    RETURN FALSE; -- Already claimed
  END IF;
  
  -- Get bonus value from platform_action_costs
  SELECT cost_credits, is_enabled INTO v_bonus_credits, v_is_enabled
  FROM platform_action_costs
  WHERE action_key = 'profile_completion_bonus';
  
  -- If not configured or disabled, use default 10
  IF v_bonus_credits IS NULL THEN
    v_bonus_credits := 10;
    v_is_enabled := TRUE;
  END IF;
  
  -- If disabled, don't grant bonus but still mark as "claimed" to prevent future attempts
  IF NOT v_is_enabled OR v_bonus_credits <= 0 THEN
    UPDATE profiles
    SET profile_completion_bonus_claimed = TRUE
    WHERE user_id = p_user_id;
    RETURN FALSE;
  END IF;
  
  -- Grant credits
  PERFORM add_platform_credits(p_user_id, p_user_type, v_bonus_credits, NULL, 
    'Bônus: Perfil 100% completo! 🎉 (+' || v_bonus_credits || ' créditos)');
  
  -- Mark as claimed
  UPDATE profiles
  SET profile_completion_bonus_claimed = TRUE
  WHERE user_id = p_user_id;
  
  -- Create notification
  INSERT INTO notifications (user_id, type, message, link)
  VALUES (
    p_user_id,
    'achievement',
    '🎉 Parabéns! Você completou 100% do seu perfil e ganhou ' || v_bonus_credits || ' créditos!',
    '/settings?tab=billing'
  );
  
  RETURN TRUE;
END;
$function$;