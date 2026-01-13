import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Coins, Sparkles, Check, QrCode, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { PixPaymentModal } from "./PixPaymentModal";
import { CardPaymentModal } from "./CardPaymentModal";
import { getAllowedCurrencies, getCurrencyByCountry } from "@/lib/currencyByCountry";

interface CreditPackage {
  credits: number;
  priceInCents: number;
  discount?: number;
  popular?: boolean;
}

// Base prices in cents (1 credit = 100 cents in local currency)
const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 10, priceInCents: 1000 },
  { credits: 50, priceInCents: 4500, discount: 10, popular: true },
  { credits: 100, priceInCents: 8000, discount: 20 },
];

type PaymentMethod = "pix" | "card";

interface BuyCreditsDialogProps {
  onSuccess?: () => void;
}

export function BuyCreditsDialog({ onSuccess }: BuyCreditsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("USD");
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>(["USD"]);
  
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

  // Fetch freelancer country on mount
  useEffect(() => {
    if (user && open) {
      fetchFreelancerCountry();
    }
  }, [user, open]);

  const fetchFreelancerCountry = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("freelancer_profiles")
      .select("country_code")
      .eq("user_id", user.id)
      .single();

    const userCountry = data?.country_code || null;
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
    
    console.log("[BuyCreditsDialog] Country:", userCountry, "Currency:", localCurrency, "Allowed:", allowed);
  };

  // Fetch MercadoPago public key on mount
  useEffect(() => {
    console.log("[BuyCreditsDialog] === PUBLIC KEY CHECK ===");
    const envKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;
    console.log("[BuyCreditsDialog] ENV source:", envKey ? "PRESENT" : "MISSING");

    if (envKey) {
      console.log("[BuyCreditsDialog] mpPublicKey source: env");
      console.log(
        "[BuyCreditsDialog] mpPublicKey masked:",
        `${envKey.substring(0, 12)}... (length: ${envKey.length})`
      );
      setMpPublicKey(envKey);
      return;
    }

    // Fallback: fetch from backend function (bypasses RLS safely)
    const fetchPublicKey = async () => {
      console.log("[BuyCreditsDialog] mpPublicKey source: db (via function - fetching...)");
      const { data, error } = await supabase.functions.invoke("get-mp-public-key");

      if (error) {
        console.error("[BuyCreditsDialog] Function fetch error:", error.message);
        console.log("[BuyCreditsDialog] mpPublicKey source: missing");
        return;
      }

      const publicKey = (data?.publicKey as string | undefined) ?? "";
      const source = (data?.source as string | undefined) ?? "missing";

      console.log("[BuyCreditsDialog] mpPublicKey source:", source);
      console.log("[BuyCreditsDialog] mpPublicKey length:", publicKey ? publicKey.length : 0);

      if (publicKey) {
        console.log(
          "[BuyCreditsDialog] mpPublicKey masked:",
          `${publicKey.substring(0, 12)}... (length: ${publicKey.length})`
        );
        setMpPublicKey(publicKey);
      }
    };

    fetchPublicKey();
  }, []);

  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseTransparentCard = isBRL && mpPublicKey.length > 0;

  const formatPrice = (priceInCents: number, curr: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: curr,
    }).format(priceInCents / 100);
  };

  const handleBuyCredits = async () => {
    console.log("[BuyCreditsDialog] === PAYMENT FLOW ===");
    console.log("[BuyCreditsDialog] paymentMethod:", paymentMethod);
    console.log("[BuyCreditsDialog] currency:", currency);
    console.log("[BuyCreditsDialog] mpPublicKey present:", !!mpPublicKey, "length:", mpPublicKey?.length || 0);

    if (!selectedPackage) {
      toast.error("Selecione um pacote de créditos");
      return;
    }

    // Validate currency is allowed
    if (!allowedCurrencies.includes(currency)) {
      toast.error("Moeda não permitida para o seu país");
      return;
    }

    setLoading(true);

    try {
      if (paymentMethod === "pix" && canUsePix) {
        console.log("[BuyCreditsDialog] → Using PIX checkout");
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            paymentType: "freelancer_credits",
            userType: "freelancer",
            amountCents: selectedPackage.priceInCents,
            creditsAmount: selectedPackage.credits,
            currency,
            description: `${selectedPackage.credits} Créditos de Proposta`,
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
        console.log("[BuyCreditsDialog] → Opening CardPaymentModal (transparent - Mercado Pago)");
        // Open transparent card checkout modal directly - NO redirect call
        setOpen(false);
        setCardModalOpen(true);
      } else if (paymentMethod === "card" && !isBRL) {
        console.log("[BuyCreditsDialog] → Using Stripe redirect for non-BRL");
        // Use Stripe redirect for international cards
        const { data, error } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType: "freelancer_credits",
            userType: "freelancer",
            amountCents: selectedPackage.priceInCents,
            creditsAmount: selectedPackage.credits,
            currency,
            description: `${selectedPackage.credits} Créditos de Proposta`,
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.location.href = data.url;
        }
      } else {
        console.warn("[BuyCreditsDialog] BRL card selected but mpPublicKey is missing");
        toast.error("Configure a Public Key em Admin > Payment Providers");
        return;
      }
    } catch (error) {
      console.error("Error creating payment:", error);
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
    if (!selectedPackage) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "freelancer_credits",
          userType: "freelancer",
          amountCents: selectedPackage.priceInCents,
          creditsAmount: selectedPackage.credits,
          currency,
          description: `${selectedPackage.credits} Créditos de Proposta`,
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

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    // Reset payment method based on currency
    if (newCurrency === "BRL") {
      setPaymentMethod("pix");
    } else {
      setPaymentMethod("card");
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
            {/* Currency Selection */}
            {allowedCurrencies.length > 1 && (
              <div className="space-y-2">
                <Label>Moeda</Label>
                <Select value={currency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedCurrencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                          {formatPrice(pkg.priceInCents, currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(pkg.priceInCents / pkg.credits * 100, currency)}/crédito
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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
            {selectedPackage && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pacote selecionado</span>
                  <span className="font-medium">{selectedPackage.credits} créditos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moeda</span>
                  <span className="font-medium">{currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span className="font-medium">{paymentMethod === "pix" ? "PIX" : "Cartão"}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-xl font-bold">
                    {formatPrice(selectedPackage.priceInCents, currency)}
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleBuyCredits}
              disabled={loading || !selectedPackage}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : paymentMethod === "pix" ? (
                <QrCode className="h-4 w-4 mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              {loading ? "Gerando pagamento..." : paymentMethod === "pix" ? "Gerar QR Code PIX" : "Pagar com Cartão"}
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
      {selectedPackage && (
        <CardPaymentModal
          open={cardModalOpen}
          onOpenChange={setCardModalOpen}
          amount={selectedPackage.priceInCents}
          publicKey={mpPublicKey}
          paymentType="freelancer_credits"
          userType="freelancer"
          creditsAmount={selectedPackage.credits}
          description={`${selectedPackage.credits} Créditos de Proposta`}
          currency={currency}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </>
  );
}
