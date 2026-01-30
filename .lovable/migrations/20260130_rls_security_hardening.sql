-- ================================================================================
-- RLS SECURITY HARDENING: Replace permissive policies with SECURITY DEFINER functions
-- Date: 2026-01-30
-- Fixes: 30 RLS policies with USING(true) or WITH CHECK(true)
-- Strategy: Block direct inserts/updates and route through SECURITY DEFINER functions
-- ================================================================================

-- ============================================
-- PART 1: FINANCIAL TABLES (CRITICAL)
-- ============================================

-- ---------------------------------------------
-- 1.1 LEDGER_TRANSACTIONS - Block direct inserts
-- Only allow inserts via SECURITY DEFINER functions
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert transactions" ON public.ledger_transactions;

-- Create restrictive policy: only admin or service role
CREATE POLICY "No direct ledger inserts"
ON public.ledger_transactions
FOR INSERT
WITH CHECK (false);

-- Note: All inserts happen via SECURITY DEFINER functions:
-- - release_escrow_to_earnings()
-- - request_withdrawal()
-- - process_withdrawal()
-- - add_credits()
-- - fund_contract_escrow()

-- ---------------------------------------------
-- 1.2 LEDGER_ENTRIES - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert ledger entries" ON public.ledger_entries;

CREATE POLICY "No direct ledger_entries inserts"
ON public.ledger_entries
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via:
-- - credit_company_wallet()
-- - add_freelancer_credits()
-- - consume_proposal_credit()

-- ---------------------------------------------
-- 1.3 UNIFIED_PAYMENTS - Restrict to service role
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert unified payments" ON public.unified_payments;
DROP POLICY IF EXISTS "System can update unified payments" ON public.unified_payments;

-- Block direct inserts (use Edge Functions with service role)
CREATE POLICY "No direct unified_payments inserts"
ON public.unified_payments
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct unified_payments updates"
ON public.unified_payments
FOR UPDATE
USING (false);

-- Allow users to view their own payments
CREATE POLICY "Users can view own unified payments"
ON public.unified_payments
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_admin()
);

-- ---------------------------------------------
-- 1.4 USER_BALANCES - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert balances" ON public.user_balances;
DROP POLICY IF EXISTS "System can update balances" ON public.user_balances;

CREATE POLICY "No direct user_balances inserts"
ON public.user_balances
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct user_balances updates"
ON public.user_balances
FOR UPDATE
USING (false);

-- Note: All balance updates via SECURITY DEFINER functions:
-- - ensure_user_balance()
-- - release_escrow_to_earnings()
-- - request_withdrawal()

-- ============================================
-- PART 2: WALLET TABLES (HIGH RISK)
-- ============================================

-- ---------------------------------------------
-- 2.1 COMPANY_WALLETS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert company wallets" ON public.company_wallets;
DROP POLICY IF EXISTS "System can update company wallets" ON public.company_wallets;

CREATE POLICY "No direct company_wallets inserts"
ON public.company_wallets
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct company_wallets updates"
ON public.company_wallets
FOR UPDATE
USING (false);

-- Note: Updates via ensure_company_wallet() and credit_company_wallet()

-- ---------------------------------------------
-- 2.2 WALLET_TRANSACTIONS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "System can update transactions" ON public.wallet_transactions;

CREATE POLICY "No direct wallet_transactions inserts"
ON public.wallet_transactions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct wallet_transactions updates"
ON public.wallet_transactions
FOR UPDATE
USING (false);

-- Note: Updates via credit_wallet()

-- ---------------------------------------------
-- 2.3 WALLETS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert wallets" ON public.wallets;
DROP POLICY IF EXISTS "System can update wallets" ON public.wallets;

CREATE POLICY "No direct wallets inserts"
ON public.wallets
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct wallets updates"
ON public.wallets
FOR UPDATE
USING (false);

-- Note: Updates via ensure_user_wallet() and credit_wallet()

-- ============================================
-- PART 3: SUBSCRIPTION/CREDIT TABLES (MEDIUM RISK)
-- ============================================

-- ---------------------------------------------
-- 3.1 COMPANY_PLANS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert company plans" ON public.company_plans;
DROP POLICY IF EXISTS "System can update company plans" ON public.company_plans;

CREATE POLICY "No direct company_plans inserts"
ON public.company_plans
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct company_plans updates"
ON public.company_plans
FOR UPDATE
USING (false);

-- Users can view their own plan
CREATE POLICY "Users can view own company plan"
ON public.company_plans
FOR SELECT
USING (company_user_id = auth.uid() OR is_admin());

-- Note: All updates via Stripe webhook or admin functions

-- ---------------------------------------------
-- 3.2 PLAN_CREDIT_GRANTS - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert grants" ON public.plan_credit_grants;

CREATE POLICY "No direct plan_credit_grants inserts"
ON public.plan_credit_grants
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via check_and_grant_plan_credits()

-- ============================================
-- PART 4: GENIUS/FEATURE ACCESS (MEDIUM RISK)
-- ============================================

-- ---------------------------------------------
-- 4.1 GENIUS_ACCESS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert genius access" ON public.genius_access;
DROP POLICY IF EXISTS "System can update genius access" ON public.genius_access;

CREATE POLICY "No direct genius_access inserts"
ON public.genius_access
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct genius_access updates"
ON public.genius_access
FOR UPDATE
USING (false);

-- Note: Updates via Edge Function genius-purchase-access

-- ---------------------------------------------
-- 4.2 GENIUS_RANKING_CACHE - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can delete ranking cache" ON public.genius_ranking_cache;
DROP POLICY IF EXISTS "System can insert ranking cache" ON public.genius_ranking_cache;
DROP POLICY IF EXISTS "System can update ranking cache" ON public.genius_ranking_cache;

CREATE POLICY "No direct genius_ranking_cache modifications"
ON public.genius_ranking_cache
FOR ALL
USING (false)
WITH CHECK (false);

-- Note: All modifications via Edge Function genius-ranking

-- ---------------------------------------------
-- 4.3 GENIUS_USAGE_LOG - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert genius usage" ON public.genius_usage_log;

CREATE POLICY "No direct genius_usage_log inserts"
ON public.genius_usage_log
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via Edge Functions

-- ============================================
-- PART 5: ACHIEVEMENT/NOTIFICATION TABLES (LOW RISK)
-- ============================================

-- ---------------------------------------------
-- 5.1 FREELANCER_ACHIEVEMENTS - Block direct modifications
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert achievements" ON public.freelancer_achievements;
DROP POLICY IF EXISTS "System can update achievements" ON public.freelancer_achievements;

CREATE POLICY "No direct freelancer_achievements inserts"
ON public.freelancer_achievements
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct freelancer_achievements updates"
ON public.freelancer_achievements
FOR UPDATE
USING (false);

-- Note: Updates via initialize_freelancer_achievements() and update_freelancer_revenue_and_achievements()

-- ---------------------------------------------
-- 5.2 NOTIFICATIONS - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "No direct notifications inserts"
ON public.notifications
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via various SECURITY DEFINER functions

-- ---------------------------------------------
-- 5.3 MESSAGE_TRANSLATIONS - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert translations" ON public.message_translations;

CREATE POLICY "No direct message_translations inserts"
ON public.message_translations
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via Edge Function translate-message

-- ---------------------------------------------
-- 5.4 PAYMENT_LOGS - Block direct inserts
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert payment logs" ON public.payment_logs;

CREATE POLICY "No direct payment_logs inserts"
ON public.payment_logs
FOR INSERT
WITH CHECK (false);

-- Note: Inserts via Edge Functions

-- ============================================
-- PART 6: CONTRACT/PROPOSAL TABLES
-- ============================================

-- ---------------------------------------------
-- 6.1 CONTRACTS - Block direct inserts (use RPC)
-- ---------------------------------------------
DROP POLICY IF EXISTS "System can insert contracts" ON public.contracts;

CREATE POLICY "No direct contracts inserts"
ON public.contracts
FOR INSERT
WITH CHECK (false);

-- Note: Created via create_contract_from_proposal() trigger or finalize_proposal_acceptance()

-- ============================================
-- PART 7: VERIFICATION CODES (Restrict to service role)
-- ============================================

-- ---------------------------------------------
-- 7.1 EMAIL_VERIFICATION_CODES - Only admin/service role
-- ---------------------------------------------
DROP POLICY IF EXISTS "Service role can manage verification codes" ON public.email_verification_codes;

-- Block all direct access, only Edge Functions with service role can access
CREATE POLICY "No direct email_verification_codes access"
ON public.email_verification_codes
FOR ALL
USING (false)
WITH CHECK (false);

-- Note: All access via send-verification-code and verify-code Edge Functions

-- ============================================
-- END OF MIGRATION
-- ================================================================================
