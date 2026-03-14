import { Button } from "@/components/ui/button";

export function CategoryFilterSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <Button variant="outline" onClick={() => onChange([])}>
      {value.length > 0 ? `Categorias (${value.length})` : "Categorias"}
    </Button>
  );
}
