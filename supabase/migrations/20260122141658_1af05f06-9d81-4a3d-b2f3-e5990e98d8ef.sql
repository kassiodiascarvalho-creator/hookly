-- Table to cache genius ranking analyses
CREATE TABLE public.genius_ranking_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  proposals_count integer NOT NULL DEFAULT 0,
  proposals_hash text NOT NULL,
  analysis_result jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one cache per project
CREATE UNIQUE INDEX idx_genius_ranking_cache_project ON public.genius_ranking_cache(project_id);

-- Enable RLS
ALTER TABLE public.genius_ranking_cache ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own ranking cache"
ON public.genius_ranking_cache FOR SELECT
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can insert ranking cache"
ON public.genius_ranking_cache FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update ranking cache"
ON public.genius_ranking_cache FOR UPDATE
USING (true);

CREATE POLICY "System can delete ranking cache"
ON public.genius_ranking_cache FOR DELETE
USING (true);