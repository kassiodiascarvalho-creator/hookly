-- Create analytics page views table
CREATE TABLE public.analytics_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  device_type TEXT DEFAULT 'desktop',
  country TEXT DEFAULT 'Unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_analytics_page_views_created_at ON public.analytics_page_views(created_at);
CREATE INDEX idx_analytics_page_views_session_id ON public.analytics_page_views(session_id);
CREATE INDEX idx_analytics_page_views_page_path ON public.analytics_page_views(page_path);

-- Enable RLS
ALTER TABLE public.analytics_page_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for tracking)
CREATE POLICY "Anyone can insert page views"
  ON public.analytics_page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read analytics data
CREATE POLICY "Admins can read analytics"
  ON public.analytics_page_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
    )
  );

-- Create a function to clean up old analytics data (older than 1 year)
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.analytics_page_views
  WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$;
