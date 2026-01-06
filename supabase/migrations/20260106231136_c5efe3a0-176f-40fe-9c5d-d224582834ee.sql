-- Add country field to freelancer_profiles table
ALTER TABLE public.freelancer_profiles ADD COLUMN IF NOT EXISTS country text;