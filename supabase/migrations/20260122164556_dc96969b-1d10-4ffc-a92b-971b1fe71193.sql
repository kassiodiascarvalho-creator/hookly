-- Drop e recriar a função de renovação mensal para exigir perfil 100%
DROP FUNCTION IF EXISTS public.check_and_grant_monthly_credits(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.check_and_grant_monthly_credits(
  p_user_id UUID,
  p_user_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_plan_type TEXT;
  v_last_grant TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_next_grant_at TIMESTAMPTZ;
  v_monthly_credits INTEGER := 10;
  v_completion_percent INTEGER;
BEGIN
  -- Buscar perfil geral do usuário
  SELECT 
    last_monthly_credit_grant_at,
    profile_completion_percent
  INTO v_profile
  FROM profiles 
  WHERE user_id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN json_build_object('granted', false, 'reason', 'PROFILE_NOT_FOUND');
  END IF;
  
  v_last_grant := v_profile.last_monthly_credit_grant_at;
  v_completion_percent := COALESCE(v_profile.profile_completion_percent, 0);
  
  -- Verificar o plano do usuário
  IF p_user_type = 'freelancer' THEN
    SELECT plan_type INTO v_plan_type 
    FROM freelancer_plans 
    WHERE freelancer_user_id = p_user_id AND status = 'active'
    LIMIT 1;
  ELSE
    SELECT plan_type INTO v_plan_type 
    FROM company_plans 
    WHERE company_user_id = p_user_id AND status = 'active'
    LIMIT 1;
  END IF;
  
  v_plan_type := COALESCE(v_plan_type, 'free');
  
  -- Só aplica para plano free
  IF v_plan_type != 'free' THEN
    RETURN json_build_object('granted', false, 'reason', 'NOT_FREE_PLAN', 'plan_type', v_plan_type);
  END IF;
  
  -- NOVO: Verificar se perfil está 100% completo
  IF v_completion_percent < 100 THEN
    -- NÃO concede e NÃO atualiza timestamp
    RETURN json_build_object(
      'granted', false, 
      'reason', 'PROFILE_INCOMPLETE',
      'completion_percent', v_completion_percent,
      'message', 'Complete seu perfil para liberar seus 10 créditos mensais.'
    );
  END IF;
  
  -- Se nunca recebeu ou já passaram 30 dias, conceder
  IF v_last_grant IS NULL OR v_now >= v_last_grant + INTERVAL '30 days' THEN
    -- Conceder créditos via RPC existente
    PERFORM add_platform_credits(
      p_user_id,
      p_user_type,
      v_monthly_credits,
      NULL,
      'Renovação mensal de créditos (Free)'
    );
    
    -- Atualizar timestamp
    UPDATE profiles 
    SET last_monthly_credit_grant_at = v_now
    WHERE user_id = p_user_id;
    
    v_next_grant_at := v_now + INTERVAL '30 days';
    
    RETURN json_build_object(
      'granted', true, 
      'amount', v_monthly_credits,
      'next_grant_at', v_next_grant_at
    );
  END IF;
  
  -- Ainda não é hora de renovar
  v_next_grant_at := v_last_grant + INTERVAL '30 days';
  
  RETURN json_build_object(
    'granted', false, 
    'reason', 'NOT_YET',
    'next_grant_at', v_next_grant_at
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_and_grant_monthly_credits(UUID, TEXT) TO authenticated;