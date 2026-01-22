import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { getCurrencySymbol } from "@/lib/formatMoney";
import { Badge } from "@/components/ui/badge";

interface ProposalBudgetValidationProps {
  proposalTotal: number;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetIdeal?: number | null;
  currency: string;
  isCounterproposal: boolean;
}

type ValidationLevel = "success" | "warning" | "error" | "info";

interface ValidationResult {
  level: ValidationLevel;
  message: string;
  description?: string;
}

export function validateProposalBudget(
  proposalTotal: number,
  budgetMin: number | null,
  budgetMax: number | null,
  budgetIdeal: number | null
): ValidationResult {
  // No budget defined
  if (!budgetMin && !budgetMax) {
    return {
      level: "info",
      message: "Orçamento livre",
      description: "Este projeto não tem orçamento definido.",
    };
  }

  // Under minimum
  if (budgetMin && proposalTotal < budgetMin) {
    const diff = budgetMin - proposalTotal;
    return {
      level: "warning",
      message: "Abaixo do orçamento mínimo",
      description: `Sua proposta está ${diff.toLocaleString()} abaixo do mínimo esperado.`,
    };
  }

  // Over maximum - requires counterproposal
  if (budgetMax && proposalTotal > budgetMax) {
    const diff = proposalTotal - budgetMax;
    const percentOver = ((diff / budgetMax) * 100).toFixed(0);
    return {
      level: "error",
      message: `Excede orçamento máximo em ${percentOver}%`,
      description: `Proposta ${diff.toLocaleString()} acima do máximo. Será enviada como contraproposta.`,
    };
  }

  // At or near ideal
  if (budgetIdeal) {
    const diffFromIdeal = Math.abs(proposalTotal - budgetIdeal);
    const percentDiff = (diffFromIdeal / budgetIdeal) * 100;

    if (percentDiff <= 5) {
      return {
        level: "success",
        message: "Valor alinhado com o ideal",
        description: "Sua proposta está dentro do orçamento ideal do projeto.",
      };
    }

    if (proposalTotal < budgetIdeal) {
      return {
        level: "success",
        message: "Abaixo do ideal - Competitivo",
        description: `Sua proposta está ${percentDiff.toFixed(0)}% abaixo do valor ideal.`,
      };
    }

    if (proposalTotal <= (budgetMax || Infinity)) {
      return {
        level: "warning",
        message: "Acima do ideal, dentro do máximo",
        description: `Sua proposta está ${percentDiff.toFixed(0)}% acima do ideal, mas dentro do orçamento.`,
      };
    }
  }

  // Within range
  return {
    level: "success",
    message: "Dentro do orçamento",
    description: "Sua proposta está dentro do range definido pela empresa.",
  };
}

export function ProposalBudgetValidation({
  proposalTotal,
  budgetMin,
  budgetMax,
  budgetIdeal,
  currency,
  isCounterproposal,
}: ProposalBudgetValidationProps) {
  const symbol = getCurrencySymbol(currency);
  const validation = validateProposalBudget(proposalTotal, budgetMin, budgetMax, budgetIdeal ?? null);

  const iconMap = {
    success: <CheckCircle className="h-4 w-4 text-green-600" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    error: <AlertTriangle className="h-4 w-4 text-destructive" />,
    info: <Info className="h-4 w-4 text-blue-600" />,
  };

  const bgMap = {
    success: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900",
    warning: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900",
  };

  if (proposalTotal === 0) {
    return null;
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgMap[validation.level]}`}>
      {iconMap[validation.level]}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{validation.message}</p>
          {isCounterproposal && (
            <Badge variant="secondary" className="text-xs">
              Contraproposta
            </Badge>
          )}
        </div>
        {validation.description && (
          <p className="text-xs text-muted-foreground">{validation.description}</p>
        )}
      </div>
      <div className="text-right">
        <p className="font-semibold">
          {symbol}{proposalTotal.toLocaleString()}
        </p>
        {budgetMax && proposalTotal > budgetMax && (
          <p className="text-xs text-destructive">
            Máx: {symbol}{budgetMax.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
