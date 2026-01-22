-- Create function to recalculate freelancer profile completion
CREATE OR REPLACE FUNCTION public.recalculate_freelancer_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_percent INTEGER := 0;
  v_user_id UUID;
  v_has_portfolio BOOLEAN;
  v_has_payout BOOLEAN;
  v_profile RECORD;
  v_bonus_already_claimed BOOLEAN;
BEGIN
  -- Get the user_id based on trigger source
  IF TG_TABLE_NAME = 'freelancer_profiles' THEN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'portfolio_items' THEN
    v_user_id := COALESCE(NEW.freelancer_user_id, OLD.freelancer_user_id);
  ELSIF TG_TABLE_NAME = 'payout_methods' THEN
    v_user_id := COALESCE(NEW.freelancer_user_id, OLD.freelancer_user_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get the freelancer profile
  SELECT * INTO v_profile FROM freelancer_profiles WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate completion based on fields (matching src/lib/profileCompletion.ts)
  -- avatar_url: 10%
  IF v_profile.avatar_url IS NOT NULL AND v_profile.avatar_url != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- full_name: 10%
  IF v_profile.full_name IS NOT NULL AND v_profile.full_name != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- title: 10%
  IF v_profile.title IS NOT NULL AND v_profile.title != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- bio: 15%
  IF v_profile.bio IS NOT NULL AND v_profile.bio != '' THEN 
    v_percent := v_percent + 15; 
  END IF;
  
  -- location: 5%
  IF v_profile.location IS NOT NULL AND v_profile.location != '' THEN 
    v_percent := v_percent + 5; 
  END IF;
  
  -- country: 5%
  IF v_profile.country IS NOT NULL AND v_profile.country != '' THEN 
    v_percent := v_percent + 5; 
  END IF;
  
  -- skills: 15%
  IF v_profile.skills IS NOT NULL AND array_length(v_profile.skills, 1) > 0 THEN 
    v_percent := v_percent + 15; 
  END IF;
  
  -- hourly_rate: 10%
  IF v_profile.hourly_rate IS NOT NULL AND v_profile.hourly_rate > 0 THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- portfolio: 10%
  SELECT EXISTS(SELECT 1 FROM portfolio_items WHERE freelancer_user_id = v_user_id LIMIT 1) INTO v_has_portfolio;
  IF v_has_portfolio THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- payout_method: 10%
  SELECT EXISTS(SELECT 1 FROM payout_methods WHERE freelancer_user_id = v_user_id LIMIT 1) INTO v_has_payout;
  IF v_has_payout THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- Update profiles table with new percentage
  UPDATE profiles 
  SET profile_completion_percent = v_percent,
      profile_completion_updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Auto-grant bonus if 100% and not already claimed
  SELECT profile_completion_bonus_claimed INTO v_bonus_already_claimed
  FROM profiles WHERE user_id = v_user_id;
  
  IF v_percent >= 100 AND NOT COALESCE(v_bonus_already_claimed, false) THEN
    PERFORM grant_profile_completion_bonus(v_user_id, 'freelancer');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to recalculate company profile completion
CREATE OR REPLACE FUNCTION public.recalculate_company_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_percent INTEGER := 0;
  v_user_id UUID;
  v_profile RECORD;
  v_bonus_already_claimed BOOLEAN;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Get the company profile
  SELECT * INTO v_profile FROM company_profiles WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate completion based on fields (matching src/lib/profileCompletion.ts)
  -- logo_url: 12%
  IF v_profile.logo_url IS NOT NULL AND v_profile.logo_url != '' THEN 
    v_percent := v_percent + 12; 
  END IF;
  
  -- company_name: 18%
  IF v_profile.company_name IS NOT NULL AND v_profile.company_name != '' THEN 
    v_percent := v_percent + 18; 
  END IF;
  
  -- website: 12%
  IF v_profile.website IS NOT NULL AND v_profile.website != '' THEN 
    v_percent := v_percent + 12; 
  END IF;
  
  -- company_size: 12%
  IF v_profile.company_size IS NOT NULL AND v_profile.company_size != '' THEN 
    v_percent := v_percent + 12; 
  END IF;
  
  -- about: 16%
  IF v_profile.about IS NOT NULL AND v_profile.about != '' THEN 
    v_percent := v_percent + 16; 
  END IF;
  
  -- industry: 10%
  IF v_profile.industry IS NOT NULL AND v_profile.industry != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- location: 10%
  IF v_profile.location IS NOT NULL AND v_profile.location != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- country: 10%
  IF v_profile.country IS NOT NULL AND v_profile.country != '' THEN 
    v_percent := v_percent + 10; 
  END IF;
  
  -- Update profiles table with new percentage
  UPDATE profiles 
  SET profile_completion_percent = v_percent,
      profile_completion_updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Auto-grant bonus if 100% and not already claimed
  SELECT profile_completion_bonus_claimed INTO v_bonus_already_claimed
  FROM profiles WHERE user_id = v_user_id;
  
  IF v_percent >= 100 AND NOT COALESCE(v_bonus_already_claimed, false) THEN
    PERFORM grant_profile_completion_bonus(v_user_id, 'company');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_recalc_freelancer_completion ON freelancer_profiles;
DROP TRIGGER IF EXISTS trigger_recalc_freelancer_completion_portfolio ON portfolio_items;
DROP TRIGGER IF EXISTS trigger_recalc_freelancer_completion_payout ON payout_methods;
DROP TRIGGER IF EXISTS trigger_recalc_company_completion ON company_profiles;

-- Create triggers for freelancer profile completion
CREATE TRIGGER trigger_recalc_freelancer_completion
  AFTER INSERT OR UPDATE ON freelancer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_freelancer_completion();

CREATE TRIGGER trigger_recalc_freelancer_completion_portfolio
  AFTER INSERT OR UPDATE OR DELETE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_freelancer_completion();

CREATE TRIGGER trigger_recalc_freelancer_completion_payout
  AFTER INSERT OR UPDATE OR DELETE ON payout_methods
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_freelancer_completion();

-- Create trigger for company profile completion
CREATE TRIGGER trigger_recalc_company_completion
  AFTER INSERT OR UPDATE ON company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_company_completion();