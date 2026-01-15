import { formatMoney } from "@/lib/formatMoney";
import { useTranslation } from "react-i18next";

interface FxFeeBreakdownProps {
  amount: number;
  feeAmount: number;
  amountAfterFee: number;
  spreadPercent: number;
  currency: string;
  paymentMethod: string;
}

/**
 * Component to display FX fee breakdown in payment modals
 * Only shows when there's a fee to display (non-USD currencies)
 */
export function FxFeeBreakdown({
  amount,
  feeAmount,
  amountAfterFee,
  spreadPercent,
  currency,
  paymentMethod,
}: FxFeeBreakdownProps) {
  const { t } = useTranslation();
  
  const spreadPercentDisplay = (spreadPercent * 100).toFixed(1);

  return (
    <div className="rounded-lg bg-muted p-4 space-y-2">
      {/* Amount being sent */}
      <div className="flex justify-between">
        <span className="text-muted-foreground">Você envia</span>
        <span className="font-medium">{formatMoney(amount, currency)}</span>
      </div>

      {/* Conversion fee */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          Taxa de conversão ({spreadPercentDisplay}%)
        </span>
        <span className="text-destructive">- {formatMoney(feeAmount, currency)}</span>
      </div>

      {/* Amount after fee */}
      <div className="flex justify-between border-t pt-2 mt-2">
        <span className="text-muted-foreground">Valor que será convertido</span>
        <span className="text-lg font-bold text-primary">
          {formatMoney(amountAfterFee, currency)}
        </span>
      </div>

      {/* Currency and payment method */}
      <div className="flex justify-between text-sm pt-1">
        <span className="text-muted-foreground">Moeda</span>
        <span>{currency}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Pagamento</span>
        <span>{paymentMethod === "pix" ? "PIX" : "Cartão"}</span>
      </div>
    </div>
  );
}
