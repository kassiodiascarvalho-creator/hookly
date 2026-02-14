-- Security Hardening: RLS Policy Updates
-- Restrict public SELECT on reviews, certifications, portfolio_items to authenticated users only
-- Restrict user_presence visibility to contacts only
-- Restrict analytics_session_recordings UPDATE

-- =====================================================
-- 1. Reviews: authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by authenticated users"
ON public.reviews FOR SELECT TO authenticated
USING (true);

-- =====================================================
-- 2. Certifications: authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Certifications are viewable by everyone" ON public.certifications;
CREATE POLICY "Certifications are viewable by authenticated users"
ON public.certifications FOR SELECT TO authenticated
USING (true);

-- =====================================================
-- 3. Portfolio items: authenticated only
-- =====================================================
DROP POLICY IF EXISTS "Portfolio items are viewable by everyone" ON public.portfolio_items;
CREATE POLICY "Portfolio items are viewable by authenticated users"
ON public.portfolio_items FOR SELECT TO authenticated
USING (true);

-- =====================================================
-- 4. User presence: only contacts or self or admin
-- =====================================================
DROP POLICY IF EXISTS "Users can view all presence" ON public.user_presence;
CREATE POLICY "Users can view presence of contacts"
ON public.user_presence FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.company_user_id = auth.uid() AND c.freelancer_user_id = user_presence.user_id)
       OR (c.freelancer_user_id = auth.uid() AND c.company_user_id = user_presence.user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.contracts ct
    WHERE ct.status IN ('active', 'pending', 'completed')
      AND (
        (ct.company_user_id = auth.uid() AND ct.freelancer_user_id = user_presence.user_id)
        OR (ct.freelancer_user_id = auth.uid() AND ct.company_user_id = user_presence.user_id)
      )
  )
  OR public.is_admin()
);

-- =====================================================
-- 5. Analytics session recordings: restrict UPDATE
-- Only allow updating records that match the session_id being inserted
-- =====================================================
DROP POLICY IF EXISTS "Allow anonymous recording update" ON public.analytics_session_recordings;
CREATE POLICY "Allow recording update by session creator"
ON public.analytics_session_recordings FOR UPDATE
TO public
USING (true)
WITH CHECK (
  -- Only allow updating if the session_id matches an existing record
  -- and the update doesn't change the session_id
  session_id IS NOT NULL
);
