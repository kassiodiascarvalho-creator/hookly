-- Create tracking_pixels table to store pixel configurations
CREATE TABLE public.tracking_pixels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_type text NOT NULL CHECK (pixel_type IN ('facebook_pixel', 'google_analytics', 'google_tag_manager')),
  pixel_id text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pixel_type)
);

-- Enable RLS
ALTER TABLE public.tracking_pixels ENABLE ROW LEVEL SECURITY;

-- Only admins can manage pixels
CREATE POLICY "Admins can manage tracking pixels"
  ON public.tracking_pixels
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Anyone can read active pixels (for frontend injection)
CREATE POLICY "Anyone can read active pixels"
  ON public.tracking_pixels
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Create updated_at trigger
CREATE TRIGGER update_tracking_pixels_updated_at
  BEFORE UPDATE ON public.tracking_pixels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
