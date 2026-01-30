import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Category } from "@/hooks/useCategories";

interface CategoryChipsProps {
  categories: Category[];
  maxVisible?: number;
  size?: "sm" | "default";
  className?: string;
}

export function CategoryChips({
  categories,
  maxVisible = 2,
  size = "default",
  className,
}: CategoryChipsProps) {
  const { i18n } = useTranslation();

  const getLocalizedName = (category: Category) => {
    return i18n.language === "pt" ? category.name_pt : category.name_en;
  };

  if (!categories.length) return null;

  const visible = categories.slice(0, maxVisible);
  const hidden = categories.slice(maxVisible);

  return (
    <div className={`flex flex-wrap gap-1 ${className || ""}`}>
      {visible.map((cat) => (
        <Badge
          key={cat.id}
          variant="outline"
          className={size === "sm" ? "text-xs py-0" : ""}
        >
          {getLocalizedName(cat)}
        </Badge>
      ))}
      
      {hidden.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={size === "sm" ? "text-xs py-0" : ""}
              >
                +{hidden.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {hidden.map((cat) => (
                  <div key={cat.id}>{getLocalizedName(cat)}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
