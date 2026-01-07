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

const CURRENCIES = ["USD", "BRL", "EUR", "GBP"];
const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

type PaymentMethod = "pix" | "card";

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

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
  const [fallbackUrl, setFallbackUrl] = useState<string>("");
  const [cardAmountCents, setCardAmountCents] = useState(0);

  useEffect(() => {
    if (user && open) {
      fetchCompanyCountry();
    }
  }, [user, open]);

  // Fetch MercadoPago public key on mount
  useEffect(() => {
    const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
    if (publicKey) {
      setMpPublicKey(publicKey);
    }
  }, []);

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

  // PIX is only available for BRL
  const canUsePix = currency === "BRL";
  // Card transparent checkout only for BRL (Mercado Pago)
  const canUseTransparentCard = currency === "BRL" && mpPublicKey;

  const handleAddFunds = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast.error("Digite um valor válido");
      return;
    }

    setLoading(true);

    try {
      const amountInCents = Math.round(numAmount * 100);
      
      if (paymentMethod === "pix" && canUsePix) {
        // Use transparent PIX checkout
        const { data, error } = await supabase.functions.invoke("create-pix-payment", {
          body: {
            paymentType: "company_wallet",
            userType: "company",
            amountCents: amountInCents,
            description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
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
        // Get fallback URL first
        const { data: fallbackData } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType: "company_wallet",
            userType: "company",
            amountCents: amountInCents,
            currency,
            description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
          },
        });

        if (fallbackData?.url) {
          setFallbackUrl(fallbackData.url);
        }

        // Open transparent card checkout modal
        setCardAmountCents(amountInCents);
        setOpen(false);
        setCardModalOpen(true);
      } else {
        // Use redirect checkout (for international cards via Stripe)
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
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 1) return;

    setLoading(true);
    try {
      const amountInCents = Math.round(numAmount * 100);
      
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "company_wallet",
          userType: "company",
          amountCents: amountInCents,
          description: `Adicionar ${formatMoney(numAmount, currency)} na carteira`,
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
                <Select value={currency} onValueChange={(v) => {
                  setCurrency(v);
                  // Reset to card if currency is not BRL
                  if (v !== "BRL") {
                    setPaymentMethod("card");
                  }
                }}>
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

            {/* Payment Method Selection - only show if BRL */}
            {canUsePix && (
              <div className="space-y-3">
                <Label>Forma de pagamento</Label>
                <div className="grid grid-cols-2 gap-3">
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
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3
                      ${paymentMethod === "card" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                      }
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
            )}

            {/* Summary */}
            {amount && parseFloat(amount) > 0 && (
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total a adicionar</span>
                  <span className="text-xl font-bold">
                    {formatMoney(parseFloat(amount), currency)}
                  </span>
                </div>
                {canUsePix && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pagamento</span>
                    <span>{paymentMethod === "pix" ? "PIX" : "Cartão"}</span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleAddFunds}
              disabled={loading || !amount || parseFloat(amount) < 1}
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
        description={`Adicionar ${formatMoney(parseFloat(amount) || 0, currency)} na carteira`}
        fallbackUrl={fallbackUrl}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}
