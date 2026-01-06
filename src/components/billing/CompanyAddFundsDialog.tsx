import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { formatMoney } from "@/lib/formatMoney";

const CURRENCIES = ["USD", "BRL", "EUR", "GBP"];
const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

interface CompanyAddFundsDialogProps {
  onSuccess?: () => void;
}

export function CompanyAddFundsDialog({ onSuccess }: CompanyAddFundsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    if (user && open) {
      fetchCompanyCountry();
    }
  }, [user, open]);

  const fetchCompanyCountry = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("company_profiles")
      .select("country")
      .eq("user_id", user.id)
      .single();

    if (data?.country) {
      setCountry(data.country);
      // Auto-select currency based on country
      if (data.country === "BR") {
        setCurrency("BRL");
      }
    }
  };

  const handleAddFunds = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast.error("Digite um valor válido");
      return;
    }

    setLoading(true);

    try {
      const amountInCents = Math.round(numAmount * 100);
      
      const { data, error } = await supabase.functions.invoke("create-unified-payment", {
        body: {
          paymentType: "company_wallet",
          userType: "company",
          amountCents: amountInCents,
          currency,
          description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error adding funds:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodInfo = country === "BR" 
    ? "Pagamento via PIX ou cartão (Mercado Pago)"
    : "Pagamento via cartão de crédito (Stripe)";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar Fundos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Adicionar Fundos
          </DialogTitle>
          <DialogDescription>
            Adicione saldo à sua carteira para acessar funcionalidades premium
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preset amounts */}
          <div className="space-y-2">
            <Label>Valores sugeridos</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  variant={amount === preset.toString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(preset.toString())}
                >
                  {formatMoney(preset, currency)}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Valor personalizado</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
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
                <span className="text-muted-foreground">Total a adicionar</span>
                <span className="text-xl font-bold">
                  {formatMoney(parseFloat(amount), currency)}
                </span>
              </div>
            </div>
          )}

          {/* Payment method info */}
          <p className="text-sm text-center text-muted-foreground">
            {paymentMethodInfo}
          </p>

          <Button
            onClick={handleAddFunds}
            disabled={loading || !amount || parseFloat(amount) < 1}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            {loading ? "Processando..." : "Continuar para pagamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
