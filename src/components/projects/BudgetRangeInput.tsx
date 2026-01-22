import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrencySymbol } from "@/lib/formatMoney";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Target, TrendingUp, DollarSign } from "lucide-react";

interface BudgetRangeInputProps {
  budgetMin: string;
  budgetIdeal: string;
  budgetMax: string;
  currency: string;
  onMinChange: (value: string) => void;
  onIdealChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  errors?: {
    min?: string;
    ideal?: string;
    max?: string;
    range?: string;
  };
}

export function BudgetRangeInput({
  budgetMin,
  budgetIdeal,
  budgetMax,
  currency,
  onMinChange,
  onIdealChange,
  onMaxChange,
  errors = {},
}: BudgetRangeInputProps) {
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-base font-medium">Orçamento do Projeto</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs p-4 space-y-2">
              <p className="font-semibold">Como funciona o orçamento?</p>
              <ul className="text-xs space-y-2">
                <li><strong>Mínimo:</strong> Valor mínimo que você está disposto a pagar</li>
                <li><strong>Ideal:</strong> Seu orçamento alvo para o projeto</li>
                <li><strong>Máximo:</strong> Limite máximo. Propostas acima deste valor requerem justificativa</li>
              </ul>
              <p className="text-xs text-primary font-medium">
                💡 Dica: Um range claro atrai propostas mais qualificadas!
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="budget_min" className="text-sm flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Mínimo
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {symbol}
            </span>
            <Input
              id="budget_min"
              type="number"
              value={budgetMin}
              onChange={(e) => onMinChange(e.target.value)}
              placeholder="0"
              className={`pl-10 ${errors.min ? "border-destructive" : ""}`}
            />
          </div>
          {errors.min && <p className="text-xs text-destructive">{errors.min}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget_ideal" className="text-sm flex items-center gap-1">
            <Target className="h-3 w-3 text-primary" />
            <span className="text-primary">Ideal</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {symbol}
            </span>
            <Input
              id="budget_ideal"
              type="number"
              value={budgetIdeal}
              onChange={(e) => onIdealChange(e.target.value)}
              placeholder="0"
              className={`pl-10 border-primary/50 focus:border-primary ${errors.ideal ? "border-destructive" : ""}`}
            />
          </div>
          {errors.ideal && <p className="text-xs text-destructive">{errors.ideal}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget_max" className="text-sm flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Máximo
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {symbol}
            </span>
            <Input
              id="budget_max"
              type="number"
              value={budgetMax}
              onChange={(e) => onMaxChange(e.target.value)}
              placeholder="0"
              className={`pl-10 ${errors.max ? "border-destructive" : ""}`}
            />
          </div>
          {errors.max && <p className="text-xs text-destructive">{errors.max}</p>}
        </div>
      </div>

      {errors.range && (
        <p className="text-sm text-destructive">{errors.range}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Freelancers poderão enviar propostas dentro do seu range. Valores acima do máximo exigem justificativa.
      </p>
    </div>
  );
}
