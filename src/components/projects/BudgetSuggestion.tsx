import { Button } from "@/components/ui/button";

interface BudgetSuggestionProps {
  title: string;
  description: string;
  category: string;
  currency: string;
  currentMin?: string;
  currentMax?: string;
  onApplySuggestion: (min: number, max: number) => void;
}

export function BudgetSuggestion({ onApplySuggestion }: BudgetSuggestionProps) {
  return (
    <Button type="button" variant="outline" onClick={() => onApplySuggestion(100, 500)}>
      Sugerir orçamento
    </Button>
  );
}
