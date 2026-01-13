import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Building, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";

interface PayoutMethod {
  id: string;
  type: "pix" | "bank";
  pix_key?: string | null;
  pix_key_type?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  branch?: string | null;
  account?: string | null;
  account_type?: string | null;
  holder_name?: string | null;
  is_default: boolean | null;
}

interface WithdrawalRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  earningsAvailable: number;
  currency: string;
  payoutMethods: PayoutMethod[];
  onSuccess: () => void;
}

export function WithdrawalRequestModal({
  open,
  onOpenChange,
  earningsAvailable,
  currency,
  payoutMethods,
  onSuccess
}: WithdrawalRequestModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [amount, setAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Reset form when opening
      setAmount("");
      setError(null);
      // Pre-select default method
      const defaultMethod = payoutMethods.find(m => m.is_default);
      if (defaultMethod) {
        setSelectedMethodId(defaultMethod.id);
      } else if (payoutMethods.length > 0) {
        setSelectedMethodId(payoutMethods[0].id);
      }
    }
  }, [open, payoutMethods]);

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal
    const sanitized = value.replace(/[^0-9.]/g, "");
    setAmount(sanitized);
    setError(null);
  };

  const handleSetMax = () => {
    setAmount(earningsAvailable.toFixed(2));
    setError(null);
  };

  const validateForm = (): boolean => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError(t("earnings.withdrawal.invalidAmount"));
      return false;
    }
    
    if (numAmount > earningsAvailable) {
      setError(t("earnings.withdrawal.exceedsBalance"));
      return false;
    }
    
    if (!selectedMethodId) {
      setError(t("earnings.withdrawal.selectMethod"));
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!user || !validateForm()) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const numAmount = parseFloat(amount);
      
      const { data, error: rpcError } = await supabase.rpc("request_withdrawal", {
        p_freelancer_user_id: user.id,
        p_amount: numAmount,
        p_payout_method_id: selectedMethodId
      });

      if (rpcError) throw rpcError;

      toast.success(t("earnings.withdrawal.success"));
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Withdrawal request error:", err);
      setError(err.message || t("common.error"));
      toast.error(t("earnings.withdrawal.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const formatMethodDisplay = (method: PayoutMethod) => {
    if (method.type === "pix") {
      return `PIX - ${method.pix_key_type?.toUpperCase()}: ${method.pix_key}`;
    }
    return `${method.bank_name} - Ag: ${method.branch} / Cc: ${method.account}`;
  };

  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount > 0 && numAmount <= earningsAvailable && selectedMethodId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t("earnings.withdrawal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("earnings.withdrawal.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Available Balance */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("earnings.withdrawal.availableBalance")}
              </span>
              <span className="text-xl font-bold text-green-600">
                {formatMoney(earningsAvailable, currency)}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t("earnings.withdrawal.amount")}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {currency}
                </span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="pl-12"
                  placeholder="0.00"
                />
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleSetMax}
                className="shrink-0"
              >
                {t("earnings.withdrawal.max")}
              </Button>
            </div>
          </div>

          {/* Payout Method Selection */}
          <div className="space-y-3">
            <Label>{t("earnings.withdrawal.payoutMethod")}</Label>
            
            {payoutMethods.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("earnings.withdrawal.noMethods")}
                </p>
              </div>
            ) : (
              <RadioGroup
                value={selectedMethodId}
                onValueChange={setSelectedMethodId}
                className="space-y-2"
              >
                {payoutMethods.map((method) => (
                  <div
                    key={method.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                      selectedMethodId === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label
                      htmlFor={method.id}
                      className="flex-1 cursor-pointer flex items-center gap-2"
                    >
                      {method.type === "pix" ? (
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{formatMethodDisplay(method)}</span>
                      {method.is_default && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {t("earnings.default")}
                        </Badge>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Summary */}
          {numAmount > 0 && isValid && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {t("earnings.withdrawal.summary", { 
                    amount: `${currency} ${numAmount.toFixed(2)}` 
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || submitting || payoutMethods.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.processing")}
              </>
            ) : (
              t("earnings.withdrawal.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
