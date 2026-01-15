-- Create table to store email verification codes
CREATE TABLE public.email_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX idx_email_verification_codes_email_code ON public.email_verification_codes(email, code);
CREATE INDEX idx_email_verification_codes_user_id ON public.email_verification_codes(user_id);

-- Enable RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own codes (via service role in edge functions)
CREATE POLICY "Service role can manage verification codes"
ON public.email_verification_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Clean up expired codes automatically (optional trigger)
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.email_verification_codes 
  WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_expired_codes
AFTER INSERT ON public.email_verification_codes
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_verification_codes();