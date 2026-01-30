-- ============================================================
-- MULTI-CATEGORY SUPPORT MIGRATION
-- ============================================================
-- Creates categories table and project_categories junction table
-- for many-to-many relationship between projects and categories

-- 1) CREATE categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_pt TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public read for active categories
CREATE POLICY "Anyone can read active categories"
  ON public.categories
  FOR SELECT
  USING (is_active = true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON public.categories
  FOR ALL
  USING (is_admin());

-- 2) CREATE project_categories junction table
CREATE TABLE IF NOT EXISTS public.project_categories (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, category_id)
);

-- Enable RLS
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read project categories (follows project visibility)
CREATE POLICY "Anyone can read project categories"
  ON public.project_categories
  FOR SELECT
  USING (true);

-- Project owners can manage their project categories
CREATE POLICY "Project owners can manage project categories"
  ON public.project_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_categories.project_id 
      AND p.company_user_id = auth.uid()
    )
  );

-- 3) INSERT all categories with proper sort order
INSERT INTO public.categories (slug, name_en, name_pt, sort_order) VALUES
  ('development', 'Development', 'Desenvolvimento', 1),
  ('mobile_development', 'Mobile Development', 'Desenvolvimento Mobile', 2),
  ('devops_cloud', 'DevOps & Cloud', 'DevOps & Cloud', 3),
  ('design', 'Design', 'Design', 4),
  ('product_ux', 'Product & UX', 'Produto & UX', 5),
  ('qa_testing', 'QA & Testing', 'QA & Testes', 6),
  ('cybersecurity', 'Cybersecurity', 'Cibersegurança', 7),
  ('data_analytics', 'Data & Analytics (BI)', 'Dados & Analytics (BI)', 8),
  ('ai_automation', 'AI & Automation', 'IA & Automação', 9),
  ('marketing', 'Marketing', 'Marketing', 10),
  ('ecommerce', 'E-commerce', 'E-commerce', 11),
  ('sales_lead_gen', 'Sales & Lead Gen', 'Vendas & Geração de Leads', 12),
  ('customer_support', 'Customer Support & Success', 'Suporte & Sucesso do Cliente', 13),
  ('operations_pm', 'Operations & Project Management', 'Operações & Gestão de Projetos', 14),
  ('admin_va', 'Admin & Virtual Assistant', 'Admin & Assistente Virtual', 15),
  ('writing', 'Writing', 'Redação', 16),
  ('translation', 'Translation & Localization', 'Tradução & Localização', 17),
  ('video_photo', 'Video & Photo', 'Vídeo & Foto', 18),
  ('engineering', 'Engineering & Architecture', 'Engenharia & Arquitetura', 19),
  ('consulting', 'Consulting', 'Consultoria', 20),
  ('finance', 'Finance', 'Finanças', 21),
  ('legal', 'Legal', 'Jurídico', 22),
  ('data_science', 'Data Science', 'Ciência de Dados', 23),
  ('other', 'Other', 'Outro', 99)
ON CONFLICT (slug) DO UPDATE SET
  name_en = EXCLUDED.name_en,
  name_pt = EXCLUDED.name_pt,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 4) MIGRATE existing projects.category to project_categories
-- Map old category keys to new slugs
INSERT INTO public.project_categories (project_id, category_id)
SELECT 
  p.id AS project_id,
  c.id AS category_id
FROM public.projects p
JOIN public.categories c ON (
  CASE p.category
    WHEN 'development' THEN 'development'
    WHEN 'design' THEN 'design'
    WHEN 'marketing' THEN 'marketing'
    WHEN 'writing' THEN 'writing'
    WHEN 'dataScience' THEN 'data_science'
    WHEN 'videoPhoto' THEN 'video_photo'
    WHEN 'consulting' THEN 'consulting'
    WHEN 'finance' THEN 'finance'
    WHEN 'legal' THEN 'legal'
    WHEN 'other' THEN 'other'
    ELSE 'other'
  END = c.slug
)
WHERE p.category IS NOT NULL AND p.category != ''
ON CONFLICT (project_id, category_id) DO NOTHING;

-- 5) Add primary_category_id to projects (optional, for ranking)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS primary_category_id UUID REFERENCES public.categories(id);

-- Set primary category from existing category field
UPDATE public.projects p
SET primary_category_id = c.id
FROM public.categories c
WHERE c.slug = (
  CASE p.category
    WHEN 'development' THEN 'development'
    WHEN 'design' THEN 'design'
    WHEN 'marketing' THEN 'marketing'
    WHEN 'writing' THEN 'writing'
    WHEN 'dataScience' THEN 'data_science'
    WHEN 'videoPhoto' THEN 'video_photo'
    WHEN 'consulting' THEN 'consulting'
    WHEN 'finance' THEN 'finance'
    WHEN 'legal' THEN 'legal'
    WHEN 'other' THEN 'other'
    ELSE 'other'
  END
)
AND p.category IS NOT NULL 
AND p.category != ''
AND p.primary_category_id IS NULL;

-- 6) Create helper function to get project categories
CREATE OR REPLACE FUNCTION public.get_project_categories(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  name_en TEXT,
  name_pt TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.slug, c.name_en, c.name_pt
  FROM categories c
  JOIN project_categories pc ON pc.category_id = c.id
  WHERE pc.project_id = p_project_id
  ORDER BY c.sort_order;
END;
$$;

-- 7) Create helper function to set project categories
CREATE OR REPLACE FUNCTION public.set_project_categories(
  p_project_id UUID,
  p_category_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_user_id UUID;
  v_category_count INTEGER;
BEGIN
  -- Verify project ownership
  SELECT company_user_id INTO v_company_user_id
  FROM projects
  WHERE id = p_project_id;
  
  IF v_company_user_id IS NULL THEN
    RAISE EXCEPTION 'Project not found';
  END IF;
  
  IF v_company_user_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Validate category count (1-5)
  v_category_count := array_length(p_category_ids, 1);
  
  IF v_category_count IS NULL OR v_category_count < 1 THEN
    RAISE EXCEPTION 'At least one category is required';
  END IF;
  
  IF v_category_count > 5 THEN
    RAISE EXCEPTION 'Maximum 5 categories allowed';
  END IF;
  
  -- Delete existing categories
  DELETE FROM project_categories WHERE project_id = p_project_id;
  
  -- Insert new categories
  INSERT INTO project_categories (project_id, category_id)
  SELECT p_project_id, unnest(p_category_ids)
  ON CONFLICT DO NOTHING;
  
  -- Set primary category to the first one
  UPDATE projects
  SET primary_category_id = p_category_ids[1],
      updated_at = now()
  WHERE id = p_project_id;
  
  RETURN TRUE;
END;
$$;

-- 8) Create index for performance
CREATE INDEX IF NOT EXISTS idx_project_categories_project 
  ON public.project_categories(project_id);
CREATE INDEX IF NOT EXISTS idx_project_categories_category 
  ON public.project_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order 
  ON public.categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_active 
  ON public.categories(is_active);
