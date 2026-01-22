-- ================================================================
-- FEATURE: Online Presence + Chat Translation System
-- ================================================================

-- 1) USER PRESENCE TABLE (for online/away/offline status)
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'offline')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_presence
CREATE POLICY "Users can view all presence" ON public.user_presence
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own presence" ON public.user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence" ON public.user_presence
  FOR UPDATE USING (auth.uid() = user_id);

-- 2) MESSAGE TRANSLATIONS TABLE (cache translations to avoid duplicate costs)
CREATE TABLE IF NOT EXISTS public.message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  translated_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, target_lang)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_message_translations_message_id ON public.message_translations(message_id);
CREATE INDEX IF NOT EXISTS idx_message_translations_langs ON public.message_translations(source_lang, target_lang);

-- Enable RLS
ALTER TABLE public.message_translations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can view translations for messages in their conversations
CREATE POLICY "Users can view translations in their conversations" ON public.message_translations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_translations.message_id
      AND (c.company_user_id = auth.uid() OR c.freelancer_user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert translations" ON public.message_translations
  FOR INSERT WITH CHECK (true);

-- 3) ADD lang_detected COLUMN TO MESSAGES TABLE
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS lang_detected TEXT;

-- 4) USER TRANSLATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_translation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_translate_enabled BOOLEAN NOT NULL DEFAULT false,
  preferred_lang TEXT NOT NULL DEFAULT 'pt-BR',
  daily_translations_used INTEGER NOT NULL DEFAULT 0,
  daily_translations_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_translation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own translation settings" ON public.user_translation_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own translation settings" ON public.user_translation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own translation settings" ON public.user_translation_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- 5) PLATFORM ACTION COSTS FOR TRANSLATION
INSERT INTO public.platform_action_costs (action_key, cost_credits, is_enabled, display_name, description)
VALUES 
  ('translate_message', 0, true, 'Traduzir Mensagem', 'Custo por tradução de mensagem no chat')
ON CONFLICT (action_key) DO NOTHING;

-- 6) Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;