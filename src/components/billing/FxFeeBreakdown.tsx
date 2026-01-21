import { formatMoney } from "@/lib/formatMoney";
import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";

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
        <span className="text-muted-foreground">{t("payments.breakdown.youSend")}</span>
        <span className="font-medium">{formatMoney(amount, currency)}</span>
      </div>

      {/* Conversion fee - using strategic terminology */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          {t("payments.breakdown.currencyProtection", { percent: spreadPercentDisplay })}
        </span>
        <span className="text-muted-foreground">- {formatMoney(feeAmount, currency)}</span>
      </div>

      {/* Amount after fee */}
      <div className="flex justify-between border-t pt-2 mt-2">
        <span className="text-muted-foreground">{t("payments.breakdown.convertedAmount")}</span>
        <span className="text-lg font-bold text-primary">
          {formatMoney(amountAfterFee, currency)}
        </span>
      </div>

      {/* Currency and payment method */}
      <div className="flex justify-between text-sm pt-1">
        <span className="text-muted-foreground">{t("payments.breakdown.currency")}</span>
        <span>{currency}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{t("payments.breakdown.paymentMethod")}</span>
        <span>{paymentMethod === "pix" ? "PIX" : t("payments.breakdown.card")}</span>
      </div>

      {/* Trust message */}
      <div className="flex items-center gap-2 pt-2 text-xs text-emerald-600 dark:text-emerald-400">
        <Shield className="h-3.5 w-3.5" />
        <span>{t("trust.messages.secureTransaction")}</span>
      </div>
    </div>
  );
}
