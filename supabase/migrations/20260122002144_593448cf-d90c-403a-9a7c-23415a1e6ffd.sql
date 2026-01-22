
-- Criar índice único para prevenir créditos duplicados via payment_id
CREATE UNIQUE INDEX IF NOT EXISTS 
  platform_credit_transactions_payment_id_unique 
  ON platform_credit_transactions(payment_id) 
  WHERE payment_id IS NOT NULL;

-- Atualizar a função add_platform_credits para usar tratamento de conflito atômico
CREATE OR REPLACE FUNCTION public.add_platform_credits(
  p_user_id uuid, 
  p_user_type text, 
  p_amount integer, 
  p_payment_id uuid DEFAULT NULL::uuid, 
  p_description text DEFAULT 'Recarga de créditos'::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Se tem payment_id, usar fail-fast approach com UNIQUE constraint
  IF p_payment_id IS NOT NULL THEN
    BEGIN
      -- Tenta inserir primeiro - se já existe, o UNIQUE constraint vai bloquear
      INSERT INTO platform_credit_transactions (
        user_id, user_type, amount, balance_after, action, description, payment_id
      ) VALUES (
        p_user_id, p_user_type, p_amount, 0, 'topup', p_description, p_payment_id
      );
    EXCEPTION WHEN unique_violation THEN
      RETURN FALSE; -- Já processado, idempotente
    END;
    
    -- Atualiza/insere o balance
    INSERT INTO platform_credits (user_id, user_type, balance)
    VALUES (p_user_id, p_user_type, p_amount)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = platform_credits.balance + p_amount,
      updated_at = now()
    RETURNING balance INTO v_new_balance;
    
    -- Atualiza o balance_after na transação já inserida
    UPDATE platform_credit_transactions 
    SET balance_after = v_new_balance 
    WHERE payment_id = p_payment_id;
    
    RETURN TRUE;
  END IF;

  -- Fluxo normal sem payment_id (grants, bonuses, ajustes manuais)
  INSERT INTO platform_credits (user_id, user_type, balance)
  VALUES (p_user_id, p_user_type, p_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    balance = platform_credits.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  INSERT INTO platform_credit_transactions (
    user_id, user_type, amount, balance_after, action, description, payment_id
  ) VALUES (
    p_user_id, p_user_type, p_amount, v_new_balance, 'topup', p_description, NULL
  );

  RETURN TRUE;
END;
$function$;
