import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_pt: string;
  sort_order: number;
}

export function useCategories() {
  const { i18n } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("categories" as any)
          .select("id, slug, name_en, name_pt, sort_order")
          .eq("is_active", true)
          .order("sort_order");

        if (fetchError) {
          setError(fetchError.message);
        } else {
          setCategories((data || []) as unknown as Category[]);
        }
      } catch (err) {
        setError("Failed to fetch categories");
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Get localized name
  const getLocalizedName = (category: Category) => {
    return i18n.language === "pt" ? category.name_pt : category.name_en;
  };

  // Get category by ID
  const getCategoryById = (id: string) => {
    return categories.find((cat) => cat.id === id);
  };

  // Get category by slug
  const getCategoryBySlug = (slug: string) => {
    return categories.find((cat) => cat.slug === slug);
  };

  // Get categories by IDs
  const getCategoriesByIds = (ids: string[]) => {
    return categories.filter((cat) => ids.includes(cat.id));
  };

  // Categories with localized names for display
  const categoriesWithLocalizedNames = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      localizedName: getLocalizedName(cat),
    }));
  }, [categories, i18n.language]);

  return {
    categories,
    categoriesWithLocalizedNames,
    loading,
    error,
    getLocalizedName,
    getCategoryById,
    getCategoryBySlug,
    getCategoriesByIds,
  };
}

// Fetch project categories by project ID
export async function fetchProjectCategories(projectId: string): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from("project_categories" as any)
      .select(`
        category_id,
        categories:category_id (
          id,
          slug,
          name_en,
          name_pt,
          sort_order
        )
      `)
      .eq("project_id", projectId);

    if (error || !data) return [];
    
    return (data as any[])
      .map((pc) => pc.categories)
      .filter(Boolean)
      .sort((a: Category, b: Category) => a.sort_order - b.sort_order);
  } catch {
    return [];
  }
}

// Set project categories
export async function setProjectCategories(
  projectId: string,
  categoryIds: string[]
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("set_project_categories" as any, {
      p_project_id: projectId,
      p_category_ids: categoryIds,
    });

    if (error) {
      console.error("Failed to set project categories:", error);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Fetch categories for multiple projects (batch)
export async function fetchProjectsCategoriesMap(
  projectIds: string[]
): Promise<Map<string, Category[]>> {
  if (!projectIds.length) return new Map();

  try {
    const { data, error } = await supabase
      .from("project_categories" as any)
      .select(`
        project_id,
        categories:category_id (
          id,
          slug,
          name_en,
          name_pt,
          sort_order
        )
      `)
      .in("project_id", projectIds);

    if (error || !data) return new Map();

    const map = new Map<string, Category[]>();
    
    for (const pc of data as any[]) {
      const pId = pc.project_id;
      const category = pc.categories;
      
      if (!category) continue;
      
      if (!map.has(pId)) {
        map.set(pId, []);
      }
      map.get(pId)!.push(category);
    }

    // Sort each project's categories by sort_order
    for (const [pId, cats] of map) {
      map.set(pId, cats.sort((a, b) => a.sort_order - b.sort_order));
    }

    return map;
  } catch {
    return new Map();
  }
}
