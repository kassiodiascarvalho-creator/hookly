-- Add company_feedback column to proposals table for counterproposal responses
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS company_feedback TEXT;