import { DollarSign, Target, TrendingUp } from "lucide-react";
import { getCurrencySymbol, formatMoney } from "@/lib/formatMoney";

interface BudgetRangeDisplayProps {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetIdeal?: number | null;
  currency: string;
  className?: string;
  compact?: boolean;
}

export function BudgetRangeDisplay({
  budgetMin,
  budgetMax,
  budgetIdeal,
  currency,
  className = "",
  compact = false,
}: BudgetRangeDisplayProps) {
  const symbol = getCurrencySymbol(currency);
  const hasRange = budgetMin || budgetMax;

  if (!hasRange) {
    return (
      <div className={`text-muted-foreground ${className}`}>
        Orçamento a negociar
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span>
          {budgetMin && budgetMax
            ? `${symbol}${budgetMin.toLocaleString()} - ${symbol}${budgetMax.toLocaleString()}`
            : budgetMin
            ? `A partir de ${symbol}${budgetMin.toLocaleString()}`
            : `Até ${symbol}${budgetMax?.toLocaleString()}`}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-muted rounded-lg space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <DollarSign className="h-4 w-4" />
        <span>Orçamento do Projeto</span>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Mínimo</p>
          <p className="font-semibold text-lg">
            {budgetMin ? `${symbol}${budgetMin.toLocaleString()}` : "-"}
          </p>
        </div>
        
        <div className="text-center border-x border-border">
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <Target className="h-3 w-3" />
            Ideal
          </p>
          <p className="font-semibold text-lg text-primary">
            {budgetIdeal ? `${symbol}${budgetIdeal.toLocaleString()}` : "-"}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Máximo
          </p>
          <p className="font-semibold text-lg">
            {budgetMax ? `${symbol}${budgetMax.toLocaleString()}` : "∞"}
          </p>
        </div>
      </div>
    </div>
  );
}
