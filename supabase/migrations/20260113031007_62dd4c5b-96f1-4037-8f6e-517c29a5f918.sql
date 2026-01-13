-- Task 4: Add currency-specific spreads table
CREATE TABLE IF NOT EXISTS public.fx_spread_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL UNIQUE,
  spread_percent NUMERIC(5,4) NOT NULL DEFAULT 0.008,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fx_spread_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage spreads
CREATE POLICY "Admins can manage fx_spread_configs"
  ON public.fx_spread_configs
  FOR ALL
  USING (public.is_admin());

-- Insert default spreads for common currencies
INSERT INTO public.fx_spread_configs (currency_code, spread_percent) VALUES
  ('BRL', 0.009),
  ('EUR', 0.006),
  ('GBP', 0.006),
  ('CAD', 0.007),
  ('AUD', 0.007),
  ('MXN', 0.010),
  ('ARS', 0.015),
  ('JPY', 0.006),
  ('CNY', 0.008),
  ('INR', 0.010),
  ('CHF', 0.005)
ON CONFLICT (currency_code) DO NOTHING;

-- Task 3: Add fx_rate_source column to track rate origin (live, cached, fallback)
ALTER TABLE public.unified_payments ADD COLUMN IF NOT EXISTS fx_rate_source TEXT;
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS fx_rate_source TEXT;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS fx_rate_source TEXT;

-- Add comments
COMMENT ON TABLE public.fx_spread_configs IS 'Currency-specific FX spread configurations for monetization';
COMMENT ON COLUMN public.fx_spread_configs.spread_percent IS 'Spread as decimal (0.008 = 0.8%)';
COMMENT ON COLUMN public.unified_payments.fx_rate_source IS 'Rate source: live, cached, or fallback';

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_fx_spread_configs_updated_at
  BEFORE UPDATE ON public.fx_spread_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();