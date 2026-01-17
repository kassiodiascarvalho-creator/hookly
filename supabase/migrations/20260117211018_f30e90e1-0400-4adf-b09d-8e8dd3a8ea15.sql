-- Create credit_purchases table to track all credit purchases with real amounts
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('freelancer', 'company')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  amount_paid_minor INTEGER NOT NULL, -- Real amount paid in minor units (cents)
  currency_paid TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT CHECK (payment_method IN ('pix', 'card_br', 'card_international', 'wallet')),
  credits_granted INTEGER NOT NULL DEFAULT 0, -- Total credits = base + bonus
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  promotion_code TEXT,
  unified_payment_id UUID REFERENCES public.unified_payments(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own credit purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all purchases
CREATE POLICY "Admins can view all credit purchases"
  ON public.credit_purchases
  FOR SELECT
  USING (public.is_admin());

-- Only system can insert/update (via service role in edge functions)
CREATE POLICY "Service role can manage credit purchases"
  ON public.credit_purchases
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin());

-- Create indexes for common queries
CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases(user_id);
CREATE INDEX idx_credit_purchases_status ON public.credit_purchases(status);
CREATE INDEX idx_credit_purchases_created_at ON public.credit_purchases(created_at);
CREATE INDEX idx_credit_purchases_confirmed ON public.credit_purchases(status, confirmed_at) WHERE status = 'confirmed';

-- Add trigger for updated_at
CREATE TRIGGER update_credit_purchases_updated_at
  BEFORE UPDATE ON public.credit_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();