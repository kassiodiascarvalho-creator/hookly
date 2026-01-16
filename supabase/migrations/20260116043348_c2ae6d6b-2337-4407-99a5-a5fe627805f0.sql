-- Create table to track company data unlocks
CREATE TABLE public.company_data_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_user_id UUID NOT NULL,
  company_user_id UUID NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  credits_spent INTEGER NOT NULL DEFAULT 1,
  UNIQUE(freelancer_user_id, company_user_id)
);

-- Enable RLS
ALTER TABLE public.company_data_unlocks ENABLE ROW LEVEL SECURITY;

-- Freelancers can view their own unlocks
CREATE POLICY "Freelancers can view own unlocks"
ON public.company_data_unlocks
FOR SELECT
USING (auth.uid() = freelancer_user_id);

-- Freelancers can create their own unlocks
CREATE POLICY "Freelancers can create own unlocks"
ON public.company_data_unlocks
FOR INSERT
WITH CHECK (auth.uid() = freelancer_user_id);

-- Create index for faster lookups
CREATE INDEX idx_company_data_unlocks_freelancer ON public.company_data_unlocks(freelancer_user_id);
CREATE INDEX idx_company_data_unlocks_company ON public.company_data_unlocks(company_user_id);