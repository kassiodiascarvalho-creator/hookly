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
import { Plus, Loader2, Wallet, QrCode, CreditCard, Info } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { PixPaymentModal } from "./PixPaymentModal";
import { CardPaymentModal } from "./CardPaymentModal";
import { getAllowedCurrencies, getCurrencyByCountry } from "@/lib/currencyByCountry";

// Each credit costs $1 USD (or equivalent in local currency)
const CREDIT_PRICE_USD = 1;
const PRESET_CREDITS = [10, 25, 50, 100, 200];

type PaymentMethod = "pix" | "card";

interface CompanyAddFundsDialogProps {
  onSuccess?: () => void;
}

export function CompanyAddFundsDialog({ onSuccess }: CompanyAddFundsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState<string | null>(null);
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>(["USD"]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");

  // PIX payment state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
    ticketUrl?: string;
  } | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string>("");
  const [pixAmount, setPixAmount] = useState(0);

  // Card payment state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [mpPublicKey, setMpPublicKey] = useState<string>("");
  const [cardAmountCents, setCardAmountCents] = useState(0);

  useEffect(() => {
    if (user && open) {
      fetchCompanyCountry();
    }
  }, [user, open]);

  // Fetch MercadoPago public key on mount
  useEffect(() => {
    const envKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;
    if (envKey) {
      setMpPublicKey(envKey);
      return;
    }

    const fetchPublicKey = async () => {
      const { data } = await supabase.functions.invoke("get-mp-public-key");
      if (data?.publicKey) {
        setMpPublicKey(data.publicKey);
      }
    };
    fetchPublicKey();
  }, []);

  const fetchCompanyCountry = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("company_profiles")
      .select("country")
      .eq("user_id", user.id)
      .single();

    const userCountry = data?.country || null;
    setCountry(userCountry);
    
    // Set allowed currencies based on country
    const allowed = getAllowedCurrencies(userCountry);
    setAllowedCurrencies(allowed);
    
    // Set default currency to local currency
    const localCurrency = getCurrencyByCountry(userCountry);
    setCurrency(localCurrency);
    
    // Set payment method based on currency
    if (localCurrency === "BRL") {
      setPaymentMethod("pix");
    } else {
      setPaymentMethod("card");
    }
  };

  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseTransparentCard = isBRL && mpPublicKey.length > 0;

  const numCredits = parseInt(credits) || 0;
  // Calculate price: 1 credit = $1 USD (no FX fees for platform credits)
  const priceUsd = numCredits * CREDIT_PRICE_USD;

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    if (newCurrency === "BRL") {
      setPaymentMethod("pix");
    } else {
      setPaymentMethod("card");
    }
  };

  const handleAddCredits = async () => {
    if (numCredits < 1) {
      toast.error("Selecione pelo menos 1 crédito");
      return;
    }

    if (!allowedCurrencies.includes(currency)) {
      toast.error("Moeda não permitida para o seu país");
      return;
    }

    setLoading(true);

    try {
      // Amount in cents (1 credit = $1 = 100 cents)
      const amountCents = priceUsd * 100;
      
      if (paymentMethod === "pix" && canUsePix) {
        // Use PIX checkout
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            paymentType: "platform_credits",
            userType: "company",
            amountCents: amountCents,
            currency,
            creditsAmount: numCredits,
            description: `Comprar ${numCredits} créditos da plataforma`,
          },
        });

        if (error) throw error;

        if (data?.pix) {
          setPixData(data.pix);
          setPixPaymentId(data.paymentId);
          setPixAmount(data.amount);
          setOpen(false);
          setPixModalOpen(true);
        }
      } else if (paymentMethod === "card" && canUseTransparentCard) {
        // Open transparent card checkout modal
        setCardAmountCents(amountCents);
        setOpen(false);
        setCardModalOpen(true);
      } else {
        // Use redirect checkout (Stripe for international)
        const { data, error } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType: "platform_credits",
            userType: "company",
            amountCents: amountCents,
            currency,
            creditsAmount: numCredits,
            description: `Comprar ${numCredits} créditos da plataforma`,
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      console.error("Error adding credits:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = () => {
    toast.success("Créditos adicionados com sucesso!");
    setPixModalOpen(false);
    setCardModalOpen(false);
    setPixData(null);
    onSuccess?.();
  };

  const handleRegeneratePixPayment = async () => {
    if (numCredits < 1) return;

    setLoading(true);
    try {
      const amountCents = priceUsd * 100;
      
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "platform_credits",
          userType: "company",
          amountCents: amountCents,
          currency,
          creditsAmount: numCredits,
          description: `Comprar ${numCredits} créditos da plataforma`,
        },
      });

      if (error) throw error;

      if (data?.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixAmount(data.amount);
        setPixModalOpen(true);
      }
    } catch (error) {
      console.error("Error regenerating PIX:", error);
      toast.error("Erro ao gerar novo PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Comprar Créditos
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Comprar Créditos
            </DialogTitle>
            <DialogDescription>
              Créditos para uso exclusivo na plataforma • Não sacável
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info Banner */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Créditos da Plataforma</p>
                <p className="text-blue-700 mt-0.5">
                  Usados para funcionalidades internas como ver dados de freelancers, 
                  destacar vagas e mais. Não podem ser usados para pagar freelancers.
                </p>
              </div>
            </div>

            {/* Currency Selection */}
            {allowedCurrencies.length > 1 && (
              <div className="space-y-2">
                <Label>Moeda de pagamento</Label>
                <Select value={currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedCurrencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === "USD" ? "USD (Dólar)" : `${c} (Moeda local)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preset credit amounts */}
            <div className="space-y-2">
              <Label>Quantidade de créditos</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_CREDITS.map((preset) => (
                  <Button
                    key={preset}
                    variant={credits === preset.toString() ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCredits(preset.toString())}
                  >
                    {preset} créditos
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div className="space-y-2">
              <Label>Quantidade personalizada</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="100"
              />
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <Label>Forma de pagamento</Label>
              <div className="grid grid-cols-2 gap-3">
                {canUsePix && (
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3
                      ${paymentMethod === "pix" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                      }
                    `}
                  >
                    <QrCode className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium">PIX</p>
                      <p className="text-xs text-muted-foreground">Instantâneo</p>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3
                    ${paymentMethod === "card" 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                    }
                    ${!canUsePix ? "col-span-2" : ""}
                  `}
                >
                  <CreditCard className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium">Cartão</p>
                    <p className="text-xs text-muted-foreground">Crédito/Débito</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Summary */}
            {numCredits > 0 && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Créditos</span>
                  <span className="text-xl font-bold">{numCredits}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Valor total</span>
                  <span className="font-semibold">
                    {formatMoney(priceUsd, "USD")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-center pt-1">
                  1 crédito = $1.00 USD • Sem taxas adicionais
                </p>
              </div>
            )}

            <Button
              onClick={handleAddCredits}
              disabled={loading || numCredits < 1}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : paymentMethod === "pix" && canUsePix ? (
                <QrCode className="h-4 w-4 mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {loading 
                ? "Processando..." 
                : paymentMethod === "pix" && canUsePix 
                  ? "Gerar QR Code PIX" 
                  : "Pagar com Cartão"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Payment Modal */}
      <PixPaymentModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        pixData={pixData}
        amount={pixAmount}
        paymentId={pixPaymentId}
        onPaymentConfirmed={handlePaymentConfirmed}
        onRegeneratePayment={handleRegeneratePixPayment}
      />

      {/* Card Payment Modal */}
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={cardAmountCents}
        publicKey={mpPublicKey}
        paymentType="platform_credits"
        userType="company"
        creditsAmount={numCredits}
        description={`Comprar ${numCredits} créditos da plataforma`}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}
