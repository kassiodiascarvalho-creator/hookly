
-- Add total_revenue column to freelancer_profiles if not exists
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0;

-- Create freelancer_achievements table
CREATE TABLE public.freelancer_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_user_id uuid NOT NULL REFERENCES public.freelancer_profiles(user_id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  title text NOT NULL,
  description text,
  subtitle text,
  required_revenue numeric NOT NULL DEFAULT 0,
  unlocked boolean NOT NULL DEFAULT false,
  unlocked_at timestamp with time zone,
  display_order integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(freelancer_user_id, achievement_key)
);

-- Enable RLS
ALTER TABLE public.freelancer_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Freelancers can view own achievements"
ON public.freelancer_achievements
FOR SELECT
USING (freelancer_user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert achievements"
ON public.freelancer_achievements
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update achievements"
ON public.freelancer_achievements
FOR UPDATE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_freelancer_achievements_updated_at
BEFORE UPDATE ON public.freelancer_achievements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize achievements for a freelancer
CREATE OR REPLACE FUNCTION public.initialize_freelancer_achievements(p_freelancer_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert all 4 achievements if they don't exist
  INSERT INTO public.freelancer_achievements (freelancer_user_id, achievement_key, title, subtitle, description, required_revenue, display_order, image_url, unlocked)
  VALUES 
    (p_freelancer_user_id, 'project_activated', 'Project', '1º marco', 'Primeiro projeto ativado. Nível desbloqueado!', 0, 1, 'https://i.imgur.com/V53Ubt2.png', false),
    (p_freelancer_user_id, 'revenue_10k', 'Blueprint', '2º marco', 'Faturamento R$ 10.000', 10000, 2, 'https://i.imgur.com/V8YIKoy.png', false),
    (p_freelancer_user_id, 'revenue_100k', 'Build', '3º marco', 'Faturamento R$ 100.000', 100000, 3, 'https://i.imgur.com/aSIv9Fm.png', false),
    (p_freelancer_user_id, 'revenue_1m', 'Scale', '4º marco', 'Faturamento R$ 1.000.000', 1000000, 4, 'https://i.imgur.com/N0zeFyL.png', false)
  ON CONFLICT (freelancer_user_id, achievement_key) DO NOTHING;
END;
$$;

-- Function to update freelancer revenue and achievements
CREATE OR REPLACE FUNCTION public.update_freelancer_revenue_and_achievements(p_freelancer_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_revenue numeric;
  v_has_accepted_project boolean;
BEGIN
  -- Calculate total revenue from released payments
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM public.payments
  WHERE freelancer_user_id = p_freelancer_user_id
    AND status = 'released';

  -- Update freelancer profile
  UPDATE public.freelancer_profiles
  SET total_revenue = v_total_revenue
  WHERE user_id = p_freelancer_user_id;

  -- Initialize achievements if not exist
  PERFORM public.initialize_freelancer_achievements(p_freelancer_user_id);

  -- Check if freelancer has any accepted project (proposal accepted)
  SELECT EXISTS(
    SELECT 1 FROM public.proposals
    WHERE freelancer_user_id = p_freelancer_user_id
      AND status = 'accepted'
  ) INTO v_has_accepted_project;

  -- Update project_activated achievement
  IF v_has_accepted_project THEN
    UPDATE public.freelancer_achievements
    SET unlocked = true, unlocked_at = COALESCE(unlocked_at, now())
    WHERE freelancer_user_id = p_freelancer_user_id
      AND achievement_key = 'project_activated'
      AND unlocked = false;
  END IF;

  -- Update revenue-based achievements (in order)
  -- Blueprint (10k)
  IF v_total_revenue >= 10000 THEN
    UPDATE public.freelancer_achievements
    SET unlocked = true, unlocked_at = COALESCE(unlocked_at, now())
    WHERE freelancer_user_id = p_freelancer_user_id
      AND achievement_key = 'revenue_10k'
      AND unlocked = false;
  END IF;

  -- Build (100k)
  IF v_total_revenue >= 100000 THEN
    UPDATE public.freelancer_achievements
    SET unlocked = true, unlocked_at = COALESCE(unlocked_at, now())
    WHERE freelancer_user_id = p_freelancer_user_id
      AND achievement_key = 'revenue_100k'
      AND unlocked = false;
  END IF;

  -- Scale (1M)
  IF v_total_revenue >= 1000000 THEN
    UPDATE public.freelancer_achievements
    SET unlocked = true, unlocked_at = COALESCE(unlocked_at, now())
    WHERE freelancer_user_id = p_freelancer_user_id
      AND achievement_key = 'revenue_1m'
      AND unlocked = false;
  END IF;
END;
$$;

-- Trigger function to auto-update on payment release
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when payment status changes to 'released'
  IF NEW.status = 'released' AND (OLD.status IS NULL OR OLD.status != 'released') THEN
    IF NEW.freelancer_user_id IS NOT NULL THEN
      PERFORM public.update_freelancer_revenue_and_achievements(NEW.freelancer_user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS update_achievements_on_payment_release ON public.payments;
CREATE TRIGGER update_achievements_on_payment_release
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_achievements_on_payment();

-- Trigger for proposal acceptance to unlock first achievement
CREATE OR REPLACE FUNCTION public.trigger_update_achievements_on_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger when proposal status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    PERFORM public.update_freelancer_revenue_and_achievements(NEW.freelancer_user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on proposals table
DROP TRIGGER IF EXISTS update_achievements_on_proposal_accept ON public.proposals;
CREATE TRIGGER update_achievements_on_proposal_accept
AFTER UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_achievements_on_proposal();
