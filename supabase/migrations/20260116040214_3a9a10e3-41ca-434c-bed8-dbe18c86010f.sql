-- Add is_highlighted column to proposals table
ALTER TABLE public.proposals 
ADD COLUMN is_highlighted BOOLEAN NOT NULL DEFAULT false;

-- Add highlighted_at column to track when it was highlighted
ALTER TABLE public.proposals 
ADD COLUMN highlighted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for sorting highlighted proposals first
CREATE INDEX idx_proposals_highlighted ON public.proposals (project_id, is_highlighted DESC, created_at DESC);