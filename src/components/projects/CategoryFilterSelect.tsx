import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, X, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useCategories, type Category } from "@/hooks/useCategories";

interface CategoryFilterSelectProps {
  value: string[]; // Array of category IDs
  onChange: (categoryIds: string[]) => void;
  className?: string;
}

export function CategoryFilterSelect({
  value,
  onChange,
  className,
}: CategoryFilterSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { categories, loading, getLocalizedName } = useCategories();

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
      onChange(value.filter((id) => id !== categoryId));
    } else {
      onChange([...value, categoryId]);
    }
  };

  // Clear all selections
  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={cn("", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full sm:w-[280px] justify-between min-h-[40px] h-auto",
              !value.length && "text-muted-foreground"
            )}
          >
            <div className="flex items-center gap-2 flex-1 text-left">
              <Filter className="h-4 w-4 shrink-0" />
              {selectedCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedCategories.length <= 2 ? (
                    selectedCategories.map((cat) => (
                      <Badge
                        key={cat.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {getLocalizedName(cat)}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {selectedCategories.length} {t("categories.selected", "selecionadas")}
                    </Badge>
                  )}
                </div>
              ) : (
                <span>{t("findProjects.allCategories", "Todas as Categorias")}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
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
          
          {/* Clear all button */}
          {value.length > 0 && (
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="w-full justify-start text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                {t("findProjects.clearFilters", "Limpar filtros")}
              </Button>
            </div>
          )}
          
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

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer",
                      isSelected && "bg-accent"
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
            {value.length === 0 
              ? t("findProjects.showingAll", "Mostrando todos os projetos")
              : t("findProjects.filteringBy", "Filtrando por {{count}} categoria(s)", { count: value.length })
            }
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
