-- Add column to track if user received the 100% profile completion bonus
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completion_bonus_claimed BOOLEAN DEFAULT FALSE;

-- Create function to grant profile completion bonus
CREATE OR REPLACE FUNCTION public.grant_profile_completion_bonus(p_user_id uuid, p_user_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_already_claimed BOOLEAN;
BEGIN
  -- Check if already claimed
  SELECT profile_completion_bonus_claimed INTO v_already_claimed
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_already_claimed = TRUE THEN
    RETURN FALSE; -- Already claimed
  END IF;
  
  -- Grant 10 credits
  PERFORM add_platform_credits(p_user_id, p_user_type, 10, NULL, 'Bônus: Perfil 100% completo! 🎉');
  
  -- Mark as claimed
  UPDATE profiles
  SET profile_completion_bonus_claimed = TRUE
  WHERE user_id = p_user_id;
  
  -- Create notification
  INSERT INTO notifications (user_id, type, message, link)
  VALUES (
    p_user_id,
    'achievement',
    '🎉 Parabéns! Você completou 100% do seu perfil e ganhou 10 créditos!',
    '/settings?tab=billing'
  );
  
  RETURN TRUE;
END;
$function$;