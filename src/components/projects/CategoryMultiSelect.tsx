import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_pt: string;
  sort_order: number;
}

interface CategoryMultiSelectProps {
  value: string[]; // Array of category IDs
  onChange: (categoryIds: string[]) => void;
  maxCategories?: number;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function CategoryMultiSelect({
  value,
  onChange,
  maxCategories = 5,
  placeholder,
  error,
  className,
}: CategoryMultiSelectProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from("categories" as any)
          .select("id, slug, name_en, name_pt, sort_order")
          .eq("is_active", true)
          .order("sort_order");

        if (!error && data) {
          setCategories(data as unknown as Category[]);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
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

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!search) return categories;
    const searchLower = search.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name_en.toLowerCase().includes(searchLower) ||
        cat.name_pt.toLowerCase().includes(searchLower) ||
        cat.slug.toLowerCase().includes(searchLower)
    );
  }, [categories, search]);

  // Get selected categories objects
  const selectedCategories = useMemo(() => {
    return categories.filter((cat) => value.includes(cat.id));
  }, [categories, value]);

  // Toggle category selection
  const toggleCategory = (categoryId: string) => {
    if (value.includes(categoryId)) {
      // Remove category
      onChange(value.filter((id) => id !== categoryId));
    } else {
      // Add category (check limit)
      if (value.length < maxCategories) {
        onChange([...value, categoryId]);
      }
    }
  };

  // Remove category chip
  const removeCategory = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((id) => id !== categoryId));
  };

  const isAtLimit = value.length >= maxCategories;

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between min-h-[40px] h-auto",
              error && "border-destructive",
              !value.length && "text-muted-foreground"
            )}
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {selectedCategories.length > 0 ? (
                selectedCategories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant="secondary"
                    className="mr-1 mb-1"
                  >
                    {getLocalizedName(cat)}
                    <button
                      type="button"
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={(e) => removeCategory(cat.id, e)}
                    >
                      <X className="h-3 w-3" />
                      <span className="sr-only">Remove</span>
                    </button>
                  </Badge>
                ))
              ) : (
                <span>{placeholder || t("categories.selectCategories", "Selecione categorias")}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("categories.searchCategories", "Buscar categorias...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto p-1">
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("common.loading", "Carregando...")}
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t("categories.noResults", "Nenhuma categoria encontrada")}
              </div>
            ) : (
              filteredCategories.map((category) => {
                const isSelected = value.includes(category.id);
                const isDisabled = isAtLimit && !isSelected;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                      isSelected && "bg-accent",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span>{getLocalizedName(category)}</span>
                  </button>
                );
              })
            )}
          </div>
          
          {/* Helper text */}
          <div className="p-2 border-t text-xs text-muted-foreground">
            {value.length}/{maxCategories} {t("categories.selected", "selecionadas")}
            {isAtLimit && (
              <span className="ml-2 text-amber-600">
                ({t("categories.limitReached", "limite atingido")})
              </span>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {error && <p className="text-sm text-destructive">{error}</p>}
      
      <p className="text-xs text-muted-foreground">
        {t("categories.selectHelper", "Selecione até {{max}} categorias para melhorar o match", { max: maxCategories })}
      </p>
    </div>
  );
}
