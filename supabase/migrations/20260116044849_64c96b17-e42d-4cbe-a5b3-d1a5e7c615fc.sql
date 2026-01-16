-- Create function to notify both parties when contract is activated
CREATE OR REPLACE FUNCTION public.notify_contract_activated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when status changes to 'active'
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Notify the company
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (
      NEW.company_user_id,
      'contract',
      'O contrato "' || NEW.title || '" foi ativado! Ambas as partes aceitaram os termos.',
      '/contracts'
    );
    
    -- Notify the freelancer
    INSERT INTO notifications (user_id, type, message, link)
    VALUES (
      NEW.freelancer_user_id,
      'contract',
      'O contrato "' || NEW.title || '" foi ativado! Ambas as partes aceitaram os termos.',
      '/contracts'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for contract activation notifications
DROP TRIGGER IF EXISTS trigger_notify_contract_activated ON contracts;
CREATE TRIGGER trigger_notify_contract_activated
  AFTER UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_activated();