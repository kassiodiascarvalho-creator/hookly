import { Badge } from "@/components/ui/badge";

type Category = { id: string; name_en?: string; name_pt?: string; slug?: string };

export function CategoryChips({ categories, maxVisible = 3 }: { categories: Category[]; maxVisible?: number; size?: "sm" | "md" }) {
  const visible = categories.slice(0, maxVisible);
  const hidden = categories.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((category) => (
        <Badge key={category.id} variant="secondary">
          {category.name_pt || category.name_en || category.slug || "Categoria"}
        </Badge>
      ))}
      {hidden > 0 && <Badge variant="outline">+{hidden}</Badge>}
    </div>
  );
}
