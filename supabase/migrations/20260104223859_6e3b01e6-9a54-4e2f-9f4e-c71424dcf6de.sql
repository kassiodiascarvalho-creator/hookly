-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for project attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for portfolio items
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars bucket (public read, authenticated upload own)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for logos bucket (public read, authenticated upload own)
CREATE POLICY "Logo images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Users can upload their own logo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own logo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own logo"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for attachments bucket (authenticated users can read their own or project-related)
CREATE POLICY "Users can view attachments for their projects"
ON storage.objects FOR SELECT
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for portfolio bucket (public read, owner upload)
CREATE POLICY "Portfolio items are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Users can upload their own portfolio items"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own portfolio items"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own portfolio items"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create portfolio_items table for freelancer portfolios
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freelancer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  project_url TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on portfolio_items
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- Portfolio items are publicly viewable
CREATE POLICY "Portfolio items are viewable by everyone"
ON public.portfolio_items FOR SELECT
USING (true);

-- Freelancers can manage their own portfolio items
CREATE POLICY "Freelancers can insert their own portfolio items"
ON public.portfolio_items FOR INSERT
WITH CHECK (auth.uid() = freelancer_user_id);

CREATE POLICY "Freelancers can update their own portfolio items"
ON public.portfolio_items FOR UPDATE
USING (auth.uid() = freelancer_user_id);

CREATE POLICY "Freelancers can delete their own portfolio items"
ON public.portfolio_items FOR DELETE
USING (auth.uid() = freelancer_user_id);

-- Create trigger for portfolio_items updated_at
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime to reviews for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;