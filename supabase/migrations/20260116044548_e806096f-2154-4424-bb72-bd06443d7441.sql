-- Update the contract creation trigger to set status as 'draft' (pending both acceptances)
CREATE OR REPLACE FUNCTION public.create_contract_from_proposal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_project RECORD;
  v_total_amount BIGINT;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get project info
    SELECT * INTO v_project FROM projects WHERE id = NEW.project_id;
    
    -- Calculate total from milestones
    SELECT COALESCE(SUM((m->>'amount')::NUMERIC * 100), 0)::BIGINT INTO v_total_amount
    FROM jsonb_array_elements(NEW.milestones) AS m;
    
    -- Create contract with 'draft' status (awaiting double acceptance)
    -- Currency is fixed from project and cannot be changed
    INSERT INTO contracts (
      proposal_id, project_id, company_user_id, freelancer_user_id,
      title, description, amount_cents, currency, milestones, status,
      company_accepted_at, freelancer_accepted_at
    )
    VALUES (
      NEW.id, NEW.project_id, v_project.company_user_id, NEW.freelancer_user_id,
      v_project.title, v_project.description, v_total_amount, v_project.currency, NEW.milestones, 'draft',
      NULL, NULL
    );
  END IF;
  
  RETURN NEW;
END;
$function$;