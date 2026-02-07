-- Tabela para armazenar feedbacks (erros e sugestões)
CREATE TABLE public.user_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('company', 'freelancer')),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'suggestion')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  resolved_by_admin_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_user_feedbacks_user_id ON public.user_feedbacks(user_id);
CREATE INDEX idx_user_feedbacks_status ON public.user_feedbacks(status);
CREATE INDEX idx_user_feedbacks_type ON public.user_feedbacks(feedback_type);
CREATE INDEX idx_user_feedbacks_created_at ON public.user_feedbacks(created_at DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_feedbacks_updated_at
  BEFORE UPDATE ON public.user_feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.user_feedbacks ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver e criar seus próprios feedbacks
CREATE POLICY "Users can view own feedbacks"
  ON public.user_feedbacks
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create feedbacks"
  ON public.user_feedbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins podem ver e atualizar todos os feedbacks
CREATE POLICY "Admins can view all feedbacks"
  ON public.user_feedbacks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update feedbacks"
  ON public.user_feedbacks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
    )
  );

-- Admins podem deletar feedbacks
CREATE POLICY "Admins can delete feedbacks"
  ON public.user_feedbacks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_permissions
      WHERE user_id = auth.uid()
    )
  );
