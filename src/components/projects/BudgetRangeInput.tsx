import { Input } from "@/components/ui/input";

interface BudgetRangeInputProps {
  budgetMin: string;
  budgetIdeal?: string;
  budgetMax: string;
  currency?: string;
  onMinChange: (v: string) => void;
  onIdealChange?: (v: string) => void;
  onMaxChange: (v: string) => void;
  errors?: { range?: string };
}

export function BudgetRangeInput({ budgetMin, budgetIdeal, budgetMax, onMinChange, onIdealChange, onMaxChange, errors }: BudgetRangeInputProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input type="number" placeholder="Min" value={budgetMin} onChange={(e) => onMinChange(e.target.value)} />
        <Input type="number" placeholder="Ideal" value={budgetIdeal || ""} onChange={(e) => onIdealChange?.(e.target.value)} />
        <Input type="number" placeholder="Max" value={budgetMax} onChange={(e) => onMaxChange(e.target.value)} />
      </div>
      {errors?.range && <p className="text-sm text-destructive">{errors.range}</p>}
    </div>
  );
}
