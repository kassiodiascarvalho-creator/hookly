-- Add spread change history table for audit trail
CREATE TABLE IF NOT EXISTS public.fx_spread_change_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fx_spread_config_id UUID REFERENCES fx_spread_configs(id),
  currency_code TEXT NOT NULL,
  old_spread_percent NUMERIC(8, 6) NOT NULL,
  new_spread_percent NUMERIC(8, 6) NOT NULL,
  changed_by_user_id UUID,
  change_reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX idx_fx_spread_history_currency ON fx_spread_change_history(currency_code);
CREATE INDEX idx_fx_spread_history_date ON fx_spread_change_history(changed_at DESC);

-- Enable RLS
ALTER TABLE fx_spread_change_history ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write history
CREATE POLICY "Admins can read spread history"
  ON fx_spread_change_history
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert spread history"
  ON fx_spread_change_history
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Add platform_settings for spread limits if not exists
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('fx_spread_min_percent', '{"value": 0}'::jsonb, 'Minimum allowed FX spread percentage'),
  ('fx_spread_max_percent', '{"value": 0.05}'::jsonb, 'Maximum allowed FX spread percentage (5%)')
ON CONFLICT (key) DO NOTHING;

-- Add comment to track setting purpose
COMMENT ON TABLE fx_spread_change_history IS 'Audit log for all FX spread configuration changes';