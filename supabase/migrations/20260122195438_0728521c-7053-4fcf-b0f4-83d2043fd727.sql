-- Create the publish_project function that the frontend is calling
CREATE OR REPLACE FUNCTION public.publish_project(p_project_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_project RECORD;
  v_company_profile RECORD;
  v_completion_percent INT;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;
  
  -- Get the project
  SELECT * INTO v_project FROM projects WHERE id = p_project_id;
  
  IF v_project IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PROJECT_NOT_FOUND');
  END IF;
  
  -- Check ownership
  IF v_project.company_user_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;
  
  -- Check if already published
  IF v_project.status != 'draft' THEN
    RETURN json_build_object('success', false, 'error', 'PROJECT_NOT_DRAFT');
  END IF;
  
  -- Get company profile and check completion
  SELECT * INTO v_company_profile FROM company_profiles WHERE user_id = v_user_id;
  
  -- Calculate completion percent
  v_completion_percent := 0;
  
  IF v_company_profile.logo_url IS NOT NULL AND v_company_profile.logo_url != '' THEN
    v_completion_percent := v_completion_percent + 12;
  END IF;
  
  IF v_company_profile.company_name IS NOT NULL AND v_company_profile.company_name != '' THEN
    v_completion_percent := v_completion_percent + 18;
  END IF;
  
  IF v_company_profile.website IS NOT NULL AND v_company_profile.website != '' THEN
    v_completion_percent := v_completion_percent + 12;
  END IF;
  
  IF v_company_profile.company_size IS NOT NULL AND v_company_profile.company_size != '' THEN
    v_completion_percent := v_completion_percent + 12;
  END IF;
  
  IF v_company_profile.about IS NOT NULL AND v_company_profile.about != '' THEN
    v_completion_percent := v_completion_percent + 16;
  END IF;
  
  IF v_company_profile.industry IS NOT NULL AND v_company_profile.industry != '' THEN
    v_completion_percent := v_completion_percent + 10;
  END IF;
  
  IF v_company_profile.location IS NOT NULL AND v_company_profile.location != '' THEN
    v_completion_percent := v_completion_percent + 10;
  END IF;
  
  IF v_company_profile.country IS NOT NULL AND v_company_profile.country != '' THEN
    v_completion_percent := v_completion_percent + 10;
  END IF;
  
  -- Require at least 80% completion to publish
  IF v_completion_percent < 80 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'COMPANY_PROFILE_INCOMPLETE',
      'completion_percent', v_completion_percent
    );
  END IF;
  
  -- Publish the project
  UPDATE projects 
  SET status = 'open', updated_at = NOW()
  WHERE id = p_project_id;
  
  RETURN json_build_object('success', true);
END;
$$;