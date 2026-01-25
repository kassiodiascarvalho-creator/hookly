import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CounterproposalJustificationProps {
  value: string;
  onChange: (value: string) => void;
  required: boolean;
  excessAmount: number;
  currency: string;
}

export function CounterproposalJustification({
  value,
  onChange,
  required,
  excessAmount,
  currency,
}: CounterproposalJustificationProps) {
  if (!required) return null;

  return (
    <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Contraproposta Obrigatória
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Sua proposta ultrapassa o orçamento máximo em{" "}
            <strong className="text-amber-900 dark:text-amber-100">{currency} {excessAmount.toLocaleString()}</strong>.
            Justifique por que este valor é necessário.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label 
          htmlFor="counterproposal-justification" 
          className="text-amber-900 dark:text-amber-100 font-medium"
        >
          Justificativa *
        </Label>
        <Textarea
          id="counterproposal-justification"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Explique por que o valor proposto é superior ao orçamento máximo. Inclua detalhes sobre complexidade técnica, escopo adicional, qualidade diferenciada, ou outros fatores que justifiquem o investimento extra..."
          rows={4}
          className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 border-amber-300 dark:border-amber-700 focus:border-amber-500 focus:ring-amber-500"
        />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {value.length}/500 caracteres (mínimo 50)
        </p>
        {value.length > 0 && value.length < 50 && (
          <p className="text-xs text-destructive font-medium">
            A justificativa deve ter pelo menos 50 caracteres
          </p>
        )}
      </div>
    </div>
  );
}
