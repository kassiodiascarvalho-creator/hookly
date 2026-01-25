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
    success: <CheckCircle className="h-4 w-4 text-green-700 dark:text-green-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />,
    error: <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-400" />,
    info: <Info className="h-4 w-4 text-blue-700 dark:text-blue-400" />,
  };

  const bgMap = {
    success: "bg-green-100 border-green-300 dark:bg-green-950/40 dark:border-green-800",
    warning: "bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
    error: "bg-red-100 border-red-300 dark:bg-red-950/40 dark:border-red-800",
    info: "bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800",
  };

  const textMap = {
    success: "text-green-900 dark:text-green-100",
    warning: "text-amber-900 dark:text-amber-100",
    error: "text-red-900 dark:text-red-100",
    info: "text-blue-900 dark:text-blue-100",
  };

  const descMap = {
    success: "text-green-800 dark:text-green-200",
    warning: "text-amber-800 dark:text-amber-200",
    error: "text-red-800 dark:text-red-200",
    info: "text-blue-800 dark:text-blue-200",
  };

  if (proposalTotal === 0) {
    return null;
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bgMap[validation.level]}`}>
      {iconMap[validation.level]}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className={`font-medium text-sm ${textMap[validation.level]}`}>{validation.message}</p>
          {isCounterproposal && (
            <Badge variant="secondary" className="text-xs">
              Contraproposta
            </Badge>
          )}
        </div>
        {validation.description && (
          <p className={`text-xs ${descMap[validation.level]}`}>{validation.description}</p>
        )}
      </div>
      <div className="text-right">
        <p className={`font-semibold ${textMap[validation.level]}`}>
          {symbol}{proposalTotal.toLocaleString()}
        </p>
        {budgetMax && proposalTotal > budgetMax && (
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">
            Máx: {symbol}{budgetMax.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
