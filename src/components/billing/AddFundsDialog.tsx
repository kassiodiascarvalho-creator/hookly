import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "BRL", "EUR", "GBP"];
const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

interface AddFundsDialogProps {
  onSuccess?: () => void;
}

export function AddFundsDialog({ onSuccess }: AddFundsDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");

  const handleAddFunds = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast.error(t("billing.invalidAmount"));
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("add-funds", {
        body: { amount: numAmount, currency },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        setOpen(false);
        onSuccess?.();
      }
    } catch (error) {
      console.error("Error adding funds:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t("billing.addFunds")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {t("billing.addFunds")}
          </DialogTitle>
          <DialogDescription>
            {t("billing.addFundsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preset amounts */}
          <div className="space-y-2">
            <Label>{t("billing.quickSelect")}</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset.toString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>{t("billing.amount")}</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("billing.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{t("billing.youWillReceive")}</span>
                <span className="text-xl font-bold">
                  {parseFloat(amount).toLocaleString()} {t("billing.contracts")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("billing.exchangeRate")}: 1 {currency} = 1 {t("billing.contract")}
              </p>
            </div>
          )}

          <Button
            onClick={handleAddFunds}
            disabled={loading || !amount || parseFloat(amount) < 1}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {t("billing.proceedToPayment")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
