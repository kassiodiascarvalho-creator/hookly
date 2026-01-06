import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Coins, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

interface CreditPackage {
  credits: number;
  priceInCents: number;
  currency: string;
  discount?: number;
  popular?: boolean;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 10, priceInCents: 1000, currency: "BRL" },
  { credits: 50, priceInCents: 4500, currency: "BRL", discount: 10, popular: true },
  { credits: 100, priceInCents: 8000, currency: "BRL", discount: 20 },
];

interface BuyCreditsDialogProps {
  onSuccess?: () => void;
}

export function BuyCreditsDialog({ onSuccess }: BuyCreditsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    // Check if freelancer has a profile with country info
    // For now, we'll default to BRL since this is freelancer-focused
    // and we use company country for routing
    setCountry("BR");
  }, [user]);

  const formatPrice = (priceInCents: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(priceInCents / 100);
  };

  const handleBuyCredits = async () => {
    if (!selectedPackage) {
      toast.error("Selecione um pacote de créditos");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-unified-payment", {
        body: {
          paymentType: "freelancer_credits",
          userType: "freelancer",
          amountCents: selectedPackage.priceInCents,
          currency: selectedPackage.currency,
          creditsAmount: selectedPackage.credits,
          description: `${selectedPackage.credits} Créditos de Proposta`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating payment:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Comprar Créditos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Comprar Créditos de Proposta
          </DialogTitle>
          <DialogDescription>
            Escolha um pacote de créditos para enviar propostas aos projetos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Package Selection */}
          <div className="space-y-3">
            <Label>Selecione um pacote</Label>
            <div className="grid gap-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <button
                  key={pkg.credits}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`
                    relative p-4 rounded-lg border-2 text-left transition-all
                    ${selectedPackage?.credits === pkg.credits 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                    }
                    ${pkg.popular ? "ring-2 ring-primary/20" : ""}
                  `}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-2 left-4">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedPackage?.credits === pkg.credits && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-xl font-bold">{pkg.credits} créditos</p>
                        {pkg.discount && (
                          <p className="text-xs text-green-600">
                            Economize {pkg.discount}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">
                        {formatPrice(pkg.priceInCents, pkg.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(pkg.priceInCents / pkg.credits * 100, pkg.currency)}/crédito
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedPackage && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pacote selecionado</span>
                <span className="font-medium">{selectedPackage.credits} créditos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold">
                  {formatPrice(selectedPackage.priceInCents, selectedPackage.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Payment Method Info */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Pagamento seguro via PIX ou cartão de crédito</p>
          </div>

          <Button
            onClick={handleBuyCredits}
            disabled={loading || !selectedPackage}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Coins className="h-4 w-4 mr-2" />
            )}
            {loading ? "Processando..." : "Comprar Créditos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
