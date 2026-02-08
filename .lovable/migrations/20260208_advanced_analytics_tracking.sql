-- Table for custom event tracking (CTA clicks, form interactions, etc.)
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_path TEXT,
  element_id TEXT,
  element_class TEXT,
  element_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for heatmap interactions (clicks, scrolls with positions)
CREATE TABLE public.analytics_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'click', 'scroll', 'hover'
  page_path TEXT NOT NULL,
  x_position INT,
  y_position INT,
  scroll_depth INT, -- percentage 0-100
  viewport_width INT,
  viewport_height INT,
  page_width INT,
  page_height INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for session recordings (rrweb data)
CREATE TABLE public.analytics_session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  recording_events JSONB DEFAULT '[]',
  duration_seconds INT DEFAULT 0,
  page_count INT DEFAULT 1,
  pages_visited TEXT[] DEFAULT '{}',
  is_bounce BOOLEAN DEFAULT true,
  device_type TEXT DEFAULT 'desktop',
  country TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_page ON public.analytics_events(page_path);

CREATE INDEX idx_analytics_interactions_session ON public.analytics_interactions(session_id);
CREATE INDEX idx_analytics_interactions_type ON public.analytics_interactions(interaction_type);
CREATE INDEX idx_analytics_interactions_page ON public.analytics_interactions(page_path);
CREATE INDEX idx_analytics_interactions_created ON public.analytics_interactions(created_at DESC);

CREATE INDEX idx_analytics_recordings_session ON public.analytics_session_recordings(session_id);
CREATE INDEX idx_analytics_recordings_created ON public.analytics_session_recordings(created_at DESC);
CREATE INDEX idx_analytics_recordings_bounce ON public.analytics_session_recordings(is_bounce);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_session_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow anonymous insert for tracking
CREATE POLICY "Allow anonymous event insert" ON public.analytics_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anonymous interaction insert" ON public.analytics_interactions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anonymous recording insert" ON public.analytics_session_recordings
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anonymous recording update" ON public.analytics_session_recordings
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies: Only admins can read
CREATE POLICY "Allow admin event select" ON public.analytics_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow admin interaction select" ON public.analytics_interactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow admin recording select" ON public.analytics_session_recordings
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = auth.uid())
  );

-- Cleanup function for old data (keep 90 days for events/interactions, 30 days for recordings)
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics_advanced()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.analytics_events WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM public.analytics_interactions WHERE created_at < NOW() - INTERVAL '90 days';
  DELETE FROM public.analytics_session_recordings WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Grant execute to authenticated users (for admin cleanup)
GRANT EXECUTE ON FUNCTION public.cleanup_old_analytics_advanced() TO authenticated;
