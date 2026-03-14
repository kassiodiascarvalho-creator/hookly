import { Button } from "@/components/ui/button";

interface KpiSuggestionProps {
  title: string;
  description: string;
  category: string;
  existingKpis: Array<{ id: string; name: string; target: string }>;
  onAddKpi: (name: string, target: string) => void;
}

export function KpiSuggestion({ onAddKpi }: KpiSuggestionProps) {
  return (
    <Button type="button" variant="outline" onClick={() => onAddKpi("KPI sugerido", "10%")}>Sugerir KPI</Button>
  );
}
