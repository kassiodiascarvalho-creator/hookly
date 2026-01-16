import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Loader2, Coins, QrCode, CreditCard, Gift, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { PixPaymentModal } from "./PixPaymentModal";
import { CardPaymentModal } from "./CardPaymentModal";
import { getAllowedCurrencies, getCurrencyByCountry } from "@/lib/currencyByCountry";
import { formatMoney } from "@/lib/formatMoney";

// Credit packages with discounts
const CREDIT_PACKAGES = [
  { credits: 10, price: 10, bonus: 0, label: "Básico" },
  { credits: 25, price: 22.5, bonus: 2.5, label: "Econômico", discount: "10%" },
  { credits: 50, price: 40, bonus: 10, label: "Popular", discount: "20%", popular: true },
  { credits: 100, price: 70, bonus: 30, label: "Profissional", discount: "30%" },
];

type PaymentMethod = "pix" | "card";

interface BuyCreditsDialogProps {
  onSuccess?: () => void;
}

export function BuyCreditsDialog({ onSuccess }: BuyCreditsDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(CREDIT_PACKAGES[0]);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
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
      .select("country_code, country")
      .eq("user_id", user.id)
      .single();

    // Use country_code first, fallback to country field
    const userCountry = data?.country_code || data?.country || null;
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
      setMpPublicKey(envKey);
      return;
    }

    // Fallback: fetch from backend function (bypasses RLS safely)
    const fetchPublicKey = async () => {
      console.log("[BuyCreditsDialog] mpPublicKey source: db (via function - fetching...)");
      const { data, error } = await supabase.functions.invoke("get-mp-public-key");

      if (error) {
        console.error("[BuyCreditsDialog] Function fetch error:", error.message);
        return;
      }

      const publicKey = (data?.publicKey as string | undefined) ?? "";
      if (publicKey) {
        setMpPublicKey(publicKey);
      }
    };

    fetchPublicKey();
  }, []);

  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseTransparentCard = isBRL && mpPublicKey.length > 0;

  // Calculate amounts based on package or custom
  const customNumAmount = parseFloat(customAmount) || 0;
  const priceToCharge = useCustomAmount ? customNumAmount : selectedPackage.price;
  const creditsToReceive = useCustomAmount ? customNumAmount : selectedPackage.credits;
  const bonusCredits = useCustomAmount ? 0 : selectedPackage.bonus;
  const totalCredits = creditsToReceive + bonusCredits;
  const amountInCents = Math.round(priceToCharge * 100);

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    // Reset payment method based on currency
    if (newCurrency === "BRL") {
      setPaymentMethod("pix");
    } else {
      setPaymentMethod("card");
    }
  };

  const handleSelectPackage = (pkg: typeof CREDIT_PACKAGES[0]) => {
    setSelectedPackage(pkg);
    setUseCustomAmount(false);
  };

  const handleBuyCredits = async () => {
    console.log("[BuyCreditsDialog] === PAYMENT FLOW ===");
    console.log("[BuyCreditsDialog] paymentMethod:", paymentMethod);
    console.log("[BuyCreditsDialog] currency:", currency);
    console.log("[BuyCreditsDialog] price:", priceToCharge, "credits:", totalCredits);

    if (priceToCharge < 1) {
      toast.error("Selecione um pacote ou digite um valor válido (mínimo 1)");
      return;
    }

    // Validate currency is allowed
    if (!allowedCurrencies.includes(currency)) {
      toast.error("Moeda não permitida para o seu país");
      return;
    }

    setLoading(true);

    // NO FX FEES for platform credits - value paid = credits received
    try {
      if (paymentMethod === "pix" && canUsePix) {
        console.log("[BuyCreditsDialog] → Using PIX checkout");
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            paymentType: "freelancer_credits",
            userType: "freelancer",
            amountCents: amountInCents,
            creditsAmount: totalCredits,
            currency,
            description: `${totalCredits} Créditos de Proposta`,
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
        setOpen(false);
        setCardModalOpen(true);
      } else if (paymentMethod === "card" && !isBRL) {
        console.log("[BuyCreditsDialog] → Using Stripe redirect for non-BRL");
        const { data, error } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType: "freelancer_credits",
            userType: "freelancer",
            amountCents: amountInCents,
            creditsAmount: totalCredits,
            currency,
            description: `${totalCredits} Créditos de Proposta`,
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
    if (priceToCharge < 1) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "freelancer_credits",
          userType: "freelancer",
          amountCents: amountInCents,
          creditsAmount: totalCredits,
          currency,
          description: `${totalCredits} Créditos de Proposta`,
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
              <Coins className="h-5 w-5 text-primary" />
              Comprar Créditos de Proposta
            </DialogTitle>
            <DialogDescription>
              Escolha a quantidade de créditos para enviar propostas aos projetos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info banner - no FX fees */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary">Créditos exclusivos da plataforma</p>
                <p className="text-muted-foreground">Sem taxa de câmbio • Não sacável • Uso interno</p>
              </div>
            </div>

            {/* Currency Selection */}
            <div className="space-y-2">
              <Label>Moeda para compra</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a moeda" />
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

            {/* Credit Packages */}
            <div className="space-y-2">
              <Label>Pacotes de Créditos</Label>
              <div className="grid grid-cols-2 gap-2">
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.credits}
                    onClick={() => handleSelectPackage(pkg)}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all relative
                      ${!useCustomAmount && selectedPackage.credits === pkg.credits
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                      }
                    `}
                  >
                    {pkg.popular && (
                      <Badge className="absolute -top-2 -right-2 text-xs">Popular</Badge>
                    )}
                    <div className="flex flex-col">
                      <span className="text-lg font-bold">{pkg.credits}</span>
                      <span className="text-xs text-muted-foreground">créditos</span>
                      <span className="text-sm font-semibold mt-1">
                        {formatMoney(pkg.price, currency)}
                      </span>
                      {pkg.bonus > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Gift className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">
                            +{pkg.bonus} bônus ({pkg.discount} off)
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount option */}
            <div className="space-y-2">
              <Label>Ou digite um valor personalizado</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setUseCustomAmount(e.target.value.length > 0 && parseFloat(e.target.value) > 0);
                }}
                placeholder="Ex: 75 créditos"
              />
              <p className="text-xs text-muted-foreground">
                1 crédito = {formatMoney(1, currency)} (sem desconto)
              </p>
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

            {/* Summary - NO FX fees */}
            {priceToCharge > 0 && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créditos</span>
                  <span className="font-medium">{creditsToReceive} créditos</span>
                </div>
                {bonusCredits > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Gift className="h-3 w-3" />
                      Bônus
                    </span>
                    <span className="font-medium">+{bonusCredits} créditos</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de créditos</span>
                  <span className="font-bold">{totalCredits} créditos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span className="font-medium">{paymentMethod === "pix" ? "PIX" : "Cartão"}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground">Você paga</span>
                  <span className="text-xl font-bold">
                    {formatMoney(priceToCharge, currency)}
                  </span>
                </div>
              </div>
            )}

            <Button
              onClick={handleBuyCredits}
              disabled={loading || priceToCharge < 1}
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
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={amountInCents}
        publicKey={mpPublicKey}
        paymentType="freelancer_credits"
        userType="freelancer"
        creditsAmount={totalCredits}
        description={`${totalCredits} Créditos de Proposta`}
        currency={currency}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}
