import { Button } from "@/components/ui/button";

interface CategoryMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  maxCategories?: number;
  error?: string;
}

export function CategoryMultiSelect({ value, onChange, maxCategories = 5, error }: CategoryMultiSelectProps) {
  const canAdd = value.length < maxCategories;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => (
          <Button key={id} type="button" variant="secondary" size="sm" onClick={() => onChange(value.filter((v) => v !== id))}>
            {id}
          </Button>
        ))}
      </div>
      {canAdd && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, `category-${value.length + 1}`])}>
          Adicionar categoria
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
