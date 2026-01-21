-- =============================================
-- HOOKLY TIER SYSTEM & MONETIZATION UPGRADE
-- =============================================

-- 1. Add tier column to freelancer_profiles
ALTER TABLE freelancer_profiles 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' 
CHECK (tier IN ('standard', 'pro', 'top_rated'));

-- 2. Create tier_fee_overrides table for differentiated fees
CREATE TABLE IF NOT EXISTS tier_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL CHECK (tier IN ('standard', 'pro', 'top_rated')),
  fee_key TEXT NOT NULL,
  fee_percent_override NUMERIC NOT NULL CHECK (fee_percent_override >= 0 AND fee_percent_override <= 0.20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tier, fee_key)
);

-- Enable RLS
ALTER TABLE tier_fee_overrides ENABLE ROW LEVEL SECURITY;

-- Policies for tier_fee_overrides
CREATE POLICY "Admins can manage tier overrides" ON tier_fee_overrides
  FOR ALL USING (is_admin());

CREATE POLICY "Anyone can read tier overrides" ON tier_fee_overrides
  FOR SELECT USING (true);

-- 3. Create credit_packages table for bonus credits system
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  bonus_credits INTEGER NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  badge_text TEXT, -- e.g., "Mais Popular", "Melhor Valor"
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for credit_packages
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit packages" ON credit_packages
  FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "Admins can manage credit packages" ON credit_packages
  FOR ALL USING (is_admin());

-- 4. Insert default credit packages
INSERT INTO credit_packages (name, credits_amount, bonus_credits, price_cents, currency, display_order, badge_text) VALUES
  ('Inicial', 10, 0, 999, 'USD', 1, NULL),
  ('Popular', 50, 10, 3999, 'USD', 2, 'Mais Popular'),
  ('Profissional', 100, 30, 6999, 'USD', 3, 'Melhor Valor'),
  ('Empresarial', 250, 100, 14999, 'USD', 4, NULL)
ON CONFLICT DO NOTHING;

-- 5. Insert default tier fee overrides (pro and top_rated get discounts)
INSERT INTO tier_fee_overrides (tier, fee_key, fee_percent_override) VALUES
  -- Pro tier: small discounts
  ('pro', 'international_card', 0.12),   -- 12% instead of 15%
  ('pro', 'brl_pix', 0.015),              -- 1.5% instead of 2%
  ('pro', 'brl_card', 0.05),              -- 5% instead of 6%
  -- Top Rated tier: bigger discounts
  ('top_rated', 'international_card', 0.10), -- 10% instead of 15%
  ('top_rated', 'brl_pix', 0.01),             -- 1% instead of 2%
  ('top_rated', 'brl_card', 0.04)             -- 4% instead of 6%
ON CONFLICT (tier, fee_key) DO NOTHING;

-- 6. Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_tier ON freelancer_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_tier_fee_overrides_tier ON tier_fee_overrides(tier);

-- 7. Add trigger for updated_at on new tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_tier_fee_overrides_updated_at ON tier_fee_overrides;
CREATE TRIGGER update_tier_fee_overrides_updated_at
  BEFORE UPDATE ON tier_fee_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_packages_updated_at ON credit_packages;
CREATE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON credit_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();