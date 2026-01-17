-- Update FX spread max limit from 5% to 20%
UPDATE platform_settings 
SET value = jsonb_set(value::jsonb, '{value}', '0.2')
WHERE key = 'fx_spread_max_percent';

-- Create payment fee configs table for centralized fee management
CREATE TABLE IF NOT EXISTS public.payment_fee_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_key TEXT UNIQUE NOT NULL,
  fee_percent NUMERIC(5,4) NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_fee_configs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read fee configs (needed for payment calculations)
CREATE POLICY "Anyone can read payment fee configs" 
ON public.payment_fee_configs 
FOR SELECT 
USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify payment fee configs" 
ON public.payment_fee_configs 
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Insert default fee configurations
INSERT INTO public.payment_fee_configs (fee_key, fee_percent, display_name, description)
VALUES 
  ('international_card', 0.15, 'Cartão Internacional', 'Taxa para pagamentos com cartão internacional (Stripe)'),
  ('brl_pix', 0.02, 'PIX (BRL)', 'Taxa para pagamentos via PIX no Brasil'),
  ('brl_card', 0.06, 'Cartão Brasil', 'Taxa para pagamentos com cartão no Brasil (Mercado Pago)')
ON CONFLICT (fee_key) DO NOTHING;

-- Create fee change history table
CREATE TABLE IF NOT EXISTS public.payment_fee_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_config_id UUID REFERENCES public.payment_fee_configs(id),
  fee_key TEXT NOT NULL,
  old_fee_percent NUMERIC(5,4) NOT NULL,
  new_fee_percent NUMERIC(5,4) NOT NULL,
  changed_by_user_id UUID,
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_fee_change_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view history
CREATE POLICY "Only admins can view payment fee history" 
ON public.payment_fee_change_history 
FOR SELECT 
USING (public.is_admin());

-- Only admins can insert history
CREATE POLICY "Only admins can insert payment fee history" 
ON public.payment_fee_change_history 
FOR INSERT 
WITH CHECK (public.is_admin());

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_payment_fee_configs_updated_at
BEFORE UPDATE ON public.payment_fee_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();