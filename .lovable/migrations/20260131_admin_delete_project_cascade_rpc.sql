-- Create RPC for admin to delete a project and all related data
CREATE OR REPLACE FUNCTION public.admin_delete_project_cascade(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract_ids uuid[];
BEGIN
  -- Verify caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete projects with cascade';
  END IF;

  -- Get all contract IDs for this project
  SELECT ARRAY_AGG(id) INTO v_contract_ids
  FROM contracts
  WHERE project_id = p_project_id;

  -- If there are contracts, clean up related data first
  IF v_contract_ids IS NOT NULL AND array_length(v_contract_ids, 1) > 0 THEN
    -- Nullify contract references in ledger_transactions
    UPDATE ledger_transactions
    SET related_contract_id = NULL
    WHERE related_contract_id = ANY(v_contract_ids);

    -- Nullify contract references in unified_payments
    UPDATE unified_payments
    SET contract_id = NULL
    WHERE contract_id = ANY(v_contract_ids);
  END IF;

  -- Nullify project references in genius_usage_log
  UPDATE genius_usage_log
  SET project_id = NULL
  WHERE project_id = p_project_id;

  -- Delete genius_ranking_cache for this project
  DELETE FROM genius_ranking_cache
  WHERE project_id = p_project_id;

  -- Now delete the project (cascades to contracts, proposals, etc.)
  DELETE FROM projects
  WHERE id = p_project_id;

  RETURN true;
END;
$$;

-- Grant execute to authenticated users (RPC checks admin internally)
GRANT EXECUTE ON FUNCTION public.admin_delete_project_cascade(uuid) TO authenticated;
