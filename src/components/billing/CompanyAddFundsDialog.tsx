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
import { Plus, Loader2, Wallet, QrCode, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { PixPaymentModal } from "./PixPaymentModal";
import { CardPaymentModal } from "./CardPaymentModal";
import { FxFeeBreakdown } from "./FxFeeBreakdown";
import { getAllowedCurrencies, getCurrencyByCountry } from "@/lib/currencyByCountry";
import { useFxSpread, calculateFxFee } from "@/hooks/useFxSpread";

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

type PaymentMethod = "pix" | "card";

interface CompanyAddFundsDialogProps {
  onSuccess?: () => void;
}

export function CompanyAddFundsDialog({ onSuccess }: CompanyAddFundsDialogProps) {
  const { user } = useAuth();
  const { spreadPercent, loading: spreadLoading } = useFxSpread();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
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
    console.log("[CompanyAddFundsDialog] === PUBLIC KEY CHECK ===");

    const envKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;
    console.log("[CompanyAddFundsDialog] ENV source:", envKey ? "PRESENT" : "MISSING");

    if (envKey) {
      console.log("[CompanyAddFundsDialog] mpPublicKey source: env");
      console.log(
        "[CompanyAddFundsDialog] mpPublicKey masked:",
        `${envKey.substring(0, 12)}... (length: ${envKey.length})`
      );
      setMpPublicKey(envKey);
      return;
    }

    // Fallback: fetch from backend function (bypasses RLS safely)
    const fetchPublicKey = async () => {
      console.log("[CompanyAddFundsDialog] mpPublicKey source: db (via function - fetching...)");
      const { data, error } = await supabase.functions.invoke("get-mp-public-key");

      if (error) {
        console.error("[CompanyAddFundsDialog] Function fetch error:", error.message);
        console.log("[CompanyAddFundsDialog] mpPublicKey source: missing");
        return;
      }

      const publicKey = (data?.publicKey as string | undefined) ?? "";
      const source = (data?.source as string | undefined) ?? "missing";

      console.log("[CompanyAddFundsDialog] mpPublicKey source:", source);
      console.log(
        "[CompanyAddFundsDialog] mpPublicKey length:",
        publicKey ? publicKey.length : 0
      );

      if (publicKey) {
        console.log(
          "[CompanyAddFundsDialog] mpPublicKey masked:",
          `${publicKey.substring(0, 12)}... (length: ${publicKey.length})`
        );
        setMpPublicKey(publicKey);
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
    
    console.log("[CompanyAddFundsDialog] Country:", userCountry, "Currency:", localCurrency, "Allowed:", allowed);
  };

  const isBRL = currency === "BRL";
  // PIX is only available for BRL
  const canUsePix = isBRL;
  // Card transparent checkout only for BRL (Mercado Pago)
  const canUseTransparentCard = isBRL && mpPublicKey.length > 0;

  const numAmount = parseFloat(amount) || 0;
  
  // Calculate FX fee
  const { feeAmount, amountAfterFee, shouldApplyFee } = calculateFxFee(
    numAmount,
    spreadPercent,
    currency
  );

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency);
    // Reset payment method based on currency
    if (newCurrency === "BRL") {
      setPaymentMethod("pix");
    } else {
      setPaymentMethod("card");
    }
  };

  const handleAddFunds = async () => {
    console.log("[CompanyAddFundsDialog] === PAYMENT FLOW ===");
    console.log("[CompanyAddFundsDialog] paymentMethod:", paymentMethod);
    console.log("[CompanyAddFundsDialog] currency:", currency);
    console.log("[CompanyAddFundsDialog] mpPublicKey present:", !!mpPublicKey, "length:", mpPublicKey?.length || 0);
    console.log("[CompanyAddFundsDialog] canUseTransparentCard:", canUseTransparentCard);
    console.log("[CompanyAddFundsDialog] FX spread:", spreadPercent, "fee:", feeAmount, "afterFee:", amountAfterFee);

    if (isNaN(numAmount) || numAmount < 1) {
      toast.error("Digite um valor válido");
      return;
    }

    // Validate currency is allowed
    if (!allowedCurrencies.includes(currency)) {
      toast.error("Moeda não permitida para o seu país");
      return;
    }

    setLoading(true);

    // Prepare FX data for backend
    const fxData = shouldApplyFee ? {
      fx_spread_percent: spreadPercent,
      fx_fee_amount: Math.round(feeAmount * 100), // Convert to cents
      amount_to_convert: Math.round(amountAfterFee * 100), // Convert to cents
    } : {};

    try {
      const amountInCents = Math.round(numAmount * 100);
      
      if (paymentMethod === "pix" && canUsePix) {
        console.log("[CompanyAddFundsDialog] → Using PIX checkout");
        // Use transparent PIX checkout
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            paymentType: "company_wallet",
            userType: "company",
            amountCents: amountInCents,
            currency,
            description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
            ...fxData,
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
        console.log("[CompanyAddFundsDialog] → Opening CardPaymentModal (transparent)");
        // Open transparent card checkout modal directly - NO redirect call
        setCardAmountCents(amountInCents);
        setOpen(false);
        setCardModalOpen(true);
      } else if (paymentMethod === "card" && isBRL && !mpPublicKey) {
        console.warn("[CompanyAddFundsDialog] BRL card selected but mpPublicKey is missing");
        toast.error("Configure a Public Key em Admin > Payment Providers");
        return;
      } else {
        console.log("[CompanyAddFundsDialog] → Using redirect (create-unified-payment)");
        // Use redirect checkout (for international cards via Stripe)
        const { data, error } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType: "company_wallet",
            userType: "company",
            amountCents: amountInCents,
            currency,
            description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
            ...fxData,
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.location.href = data.url;
        }
      }
    } catch (error) {
      console.error("Error adding funds:", error);
      toast.error("Erro ao processar pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = () => {
    toast.success("Fundos adicionados com sucesso!");
    setPixModalOpen(false);
    setCardModalOpen(false);
    setPixData(null);
    onSuccess?.();
  };

  const handleRegeneratePixPayment = async () => {
    if (isNaN(numAmount) || numAmount < 1) return;

    const fxData = shouldApplyFee ? {
      fx_spread_percent: spreadPercent,
      fx_fee_amount: Math.round(feeAmount * 100),
      amount_to_convert: Math.round(amountAfterFee * 100),
    } : {};

    setLoading(true);
    try {
      const amountInCents = Math.round(numAmount * 100);
      
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "company_wallet",
          userType: "company",
          amountCents: amountInCents,
          currency,
          description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
          ...fxData,
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
                        {c === "USD" ? "USD (Dólar)" : `${c} (Moeda local)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
            <div className="space-y-2">
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

            {/* Summary - with FX breakdown for non-USD */}
            {numAmount > 0 && (
              shouldApplyFee ? (
                <FxFeeBreakdown
                  amount={numAmount}
                  feeAmount={feeAmount}
                  amountAfterFee={amountAfterFee}
                  spreadPercent={spreadPercent}
                  currency={currency}
                  paymentMethod={paymentMethod}
                />
              ) : (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total a adicionar</span>
                    <span className="text-xl font-bold">
                      {formatMoney(numAmount, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Moeda</span>
                    <span>{currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span>{paymentMethod === "pix" ? "PIX" : "Cartão"}</span>
                  </div>
                </div>
              )
            )}

            <Button
              onClick={handleAddFunds}
              disabled={loading || !amount || numAmount < 1 || spreadLoading}
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
        paymentType="company_wallet"
        userType="company"
        description={`Adicionar ${formatMoney(numAmount, currency)} na carteira`}
        currency={currency}
        onPaymentConfirmed={handlePaymentConfirmed}
        fxSpreadPercent={shouldApplyFee ? spreadPercent : undefined}
        fxFeeAmount={shouldApplyFee ? Math.round(feeAmount * 100) : undefined}
        amountToConvert={shouldApplyFee ? Math.round(amountAfterFee * 100) : undefined}
      />
    </>
  );
}
