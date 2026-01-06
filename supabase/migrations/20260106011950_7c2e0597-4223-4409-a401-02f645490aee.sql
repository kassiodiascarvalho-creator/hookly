-- 1. Add verification fields to company_profiles
ALTER TABLE public.company_profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS verified_by_admin_id uuid;

-- 2. Add verification tracking fields to freelancer_profiles (verified exists, add tracking)
ALTER TABLE public.freelancer_profiles 
ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS verified_by_admin_id uuid;

-- 3. Add fields to leads table for user_type filtering
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS user_type text;

-- 4. Add message type and file fields for media support
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_name text,
ADD COLUMN IF NOT EXISTS file_mime text,
ADD COLUMN IF NOT EXISTS file_size integer,
ADD COLUMN IF NOT EXISTS audio_duration integer;

-- 5. Add payment tracking field for manual payout
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS paid_out_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_out_by_admin_id uuid;

-- 6. Create chat_uploads storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_uploads', 'chat_uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 7. Create storage policies for chat_uploads
CREATE POLICY "Users can upload files to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat_uploads' AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.company_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
  )
);

CREATE POLICY "Users can view files in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat_uploads' AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.company_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
  )
);

CREATE POLICY "Users can delete their own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat_uploads' AND
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND (c.company_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
  )
);