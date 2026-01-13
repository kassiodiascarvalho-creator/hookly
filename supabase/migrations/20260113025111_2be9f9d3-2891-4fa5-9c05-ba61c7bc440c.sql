-- =====================================================
-- TAREFA 1: Add FX (Foreign Exchange) fields for USD-based ledger
-- All internal accounting will be in USD, but we track original currency
-- =====================================================

-- Add FX fields to unified_payments table
ALTER TABLE public.unified_payments
ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS payment_amount_minor BIGINT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS gateway_provider TEXT,
ADD COLUMN IF NOT EXISTS amount_usd_minor BIGINT,
ADD COLUMN IF NOT EXISTS fx_rate_market DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_rate_applied DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_spread_percent DECIMAL(5, 4) DEFAULT 0.008,
ADD COLUMN IF NOT EXISTS fx_spread_amount_usd_minor BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS fx_provider TEXT,
ADD COLUMN IF NOT EXISTS fx_timestamp TIMESTAMP WITH TIME ZONE;

-- Add FX fields to ledger_transactions table
ALTER TABLE public.ledger_transactions
ADD COLUMN IF NOT EXISTS payment_currency TEXT,
ADD COLUMN IF NOT EXISTS payment_amount_minor BIGINT,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS gateway_provider TEXT,
ADD COLUMN IF NOT EXISTS amount_usd_minor BIGINT,
ADD COLUMN IF NOT EXISTS fx_rate_market DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_rate_applied DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_spread_percent DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS fx_spread_amount_usd_minor BIGINT,
ADD COLUMN IF NOT EXISTS fx_provider TEXT,
ADD COLUMN IF NOT EXISTS fx_timestamp TIMESTAMP WITH TIME ZONE;

-- Add FX fields to withdrawal_requests table
ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS payment_currency TEXT,
ADD COLUMN IF NOT EXISTS payment_amount_minor BIGINT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer',
ADD COLUMN IF NOT EXISTS gateway_provider TEXT,
ADD COLUMN IF NOT EXISTS amount_usd_minor BIGINT,
ADD COLUMN IF NOT EXISTS fx_rate_market DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_rate_applied DECIMAL(18, 10),
ADD COLUMN IF NOT EXISTS fx_spread_percent DECIMAL(5, 4),
ADD COLUMN IF NOT EXISTS fx_spread_amount_usd_minor BIGINT,
ADD COLUMN IF NOT EXISTS fx_provider TEXT,
ADD COLUMN IF NOT EXISTS fx_timestamp TIMESTAMP WITH TIME ZONE;

-- Ensure freelancer_profiles has country_code and currency_code (Task 2 prep)
ALTER TABLE public.freelancer_profiles
ADD COLUMN IF NOT EXISTS country_code TEXT,
ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'USD';

-- Create a platform_settings table for configurable FX spread
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write platform settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Insert default FX spread setting
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'fx_spread_percent',
  '{"value": 0.008, "min": 0, "max": 0.05}'::jsonb,
  'Foreign exchange spread percentage applied to currency conversions (0.008 = 0.8%)'
)
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_unified_payments_payment_currency ON public.unified_payments(payment_currency);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_payment_currency ON public.ledger_transactions(payment_currency);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_country_code ON public.freelancer_profiles(country_code);

-- Update trigger for platform_settings
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.platform_settings IS 'Platform-wide configuration settings, including FX spread';
COMMENT ON COLUMN public.unified_payments.payment_currency IS 'Original payment currency (ISO-4217)';
COMMENT ON COLUMN public.unified_payments.amount_usd_minor IS 'Amount converted to USD in minor units (cents)';
COMMENT ON COLUMN public.unified_payments.fx_rate_market IS 'Market exchange rate at time of transaction';
COMMENT ON COLUMN public.unified_payments.fx_rate_applied IS 'Rate applied after spread (market rate * (1 - spread))';
COMMENT ON COLUMN public.unified_payments.fx_spread_percent IS 'Spread percentage applied (platform fee)';
COMMENT ON COLUMN public.unified_payments.fx_spread_amount_usd_minor IS 'Platform earnings from spread in USD cents';