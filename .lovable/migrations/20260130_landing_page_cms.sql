-- Landing page content management
CREATE TABLE public.landing_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  section_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  title text,
  subtitle text,
  content jsonb DEFAULT '{}',
  background_image_url text,
  background_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;

-- Public read access for landing page
CREATE POLICY "Anyone can view visible landing sections"
ON public.landing_sections
FOR SELECT
USING (is_visible = true);

-- Admin write access
CREATE POLICY "Admins can manage landing sections"
ON public.landing_sections
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default sections
INSERT INTO public.landing_sections (section_key, section_order, title, subtitle, content) VALUES
('hero', 1, 'Hero Section', 'Seção principal da página', 
  '{"title": "Conecte-se aos Melhores", "titleLine2": "Talentos do Mercado", "titleLine3": "Freelancers Premium, Resultados Reais", "subtitle": "Plataforma completa para contratar freelancers verificados com sistema de escrow seguro e pagamento baseado em KPIs", "ctaPrimary": "Começar Agora", "ctaSecondary": "Ver Talentos"}'::jsonb),
('categories', 2, 'Categorias', 'Explore nossas categorias de serviços',
  '{"title": "Encontre Talentos por Categoria", "subtitle": "Profissionais especializados em diversas áreas"}'::jsonb),
('howItWorks', 3, 'Como Funciona', 'Processo simples em 3 passos',
  '{"title": "Como Funciona", "subtitle": "Processo simples e seguro para contratar os melhores talentos"}'::jsonb),
('comparison', 4, 'Comparação', 'Por que escolher o HOOKLY',
  '{"title": "Por que escolher o HOOKLY?", "subtitle": "Veja como nos destacamos da concorrência"}'::jsonb),
('benefits', 5, 'Benefícios', 'Para Empresas e Freelancers',
  '{"title": "Benefícios para Todos", "subtitle": "Vantagens exclusivas para empresas e freelancers"}'::jsonb),
('faq', 6, 'FAQ', 'Perguntas Frequentes',
  '{"title": "Perguntas Frequentes", "subtitle": "Tire suas dúvidas sobre a plataforma"}'::jsonb),
('cta', 7, 'Call to Action', 'Seção final de conversão',
  '{"title": "Pronto para Começar?", "subtitle": "Junte-se a milhares de empresas e freelancers", "ctaPrimary": "Criar Conta Grátis", "ctaSecondary": "Falar com Especialista"}'::jsonb);

-- FAQ items table
CREATE TABLE public.landing_faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.landing_faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible FAQ items"
ON public.landing_faq_items
FOR SELECT
USING (is_visible = true);

CREATE POLICY "Admins can manage FAQ items"
ON public.landing_faq_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default FAQ items
INSERT INTO public.landing_faq_items (question, answer, display_order) VALUES
('Como funciona o sistema de pagamentos?', 'Utilizamos um sistema de escrow seguro. O cliente deposita o valor do projeto e ele fica protegido até a entrega ser aprovada. Assim, garantimos segurança para ambas as partes.', 1),
('Quanto custa usar a plataforma?', 'A criação de conta é gratuita. Cobramos uma pequena taxa sobre os projetos concluídos, que é transparente e sem custos ocultos.', 2),
('Como os freelancers são verificados?', 'Nosso processo de verificação inclui análise de portfólio, validação de identidade e avaliações de clientes anteriores.', 3),
('Posso cancelar um projeto?', 'Sim, projetos podem ser cancelados seguindo nossa política de cancelamento. O valor em escrow é tratado de acordo com o andamento do projeto.', 4),
('Qual o prazo para receber os pagamentos?', 'Freelancers recebem o pagamento em até 3 dias úteis após a aprovação da entrega pelo cliente.', 5);

-- Stats items table
CREATE TABLE public.landing_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  icon text NOT NULL DEFAULT 'Users',
  display_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.landing_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible stats"
ON public.landing_stats
FOR SELECT
USING (is_visible = true);

CREATE POLICY "Admins can manage stats"
ON public.landing_stats
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default stats
INSERT INTO public.landing_stats (label, value, icon, display_order) VALUES
('Talentos Verificados', '2,500+', 'Users', 1),
('Projetos Pagos', '8,400+', 'Briefcase', 2),
('Satisfação', '98%', 'Star', 3),
('Categorias', '45+', 'Globe', 4);
