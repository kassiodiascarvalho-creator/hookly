-- Add profile completion fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completion_percent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_completion_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing profiles to have onboarding_completed = true if they have a user_type
UPDATE public.profiles 
SET onboarding_completed = TRUE 
WHERE user_type IS NOT NULL;

-- Create index for faster queries on completion
CREATE INDEX IF NOT EXISTS idx_profiles_completion ON public.profiles(profile_completion_percent);