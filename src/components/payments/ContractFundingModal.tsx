import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, QrCode, CreditCard, Wallet, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { PixPaymentModal } from "@/components/billing/PixPaymentModal";
import { CardPaymentModal } from "@/components/billing/CardPaymentModal";
import { StripeCardModal } from "@/components/billing/StripeCardModal";

type PaymentMethod = "credits" | "pix" | "card";

interface ContractFundingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  amount: number; // in currency units (e.g., 100.00)
  currency: string;
  description: string;
  freelancerUserId: string;
  onPaymentComplete: () => void;
}

interface CompanyWallet {
  balance_cents: number;
  currency: string;
}

export function ContractFundingModal({
  open,
  onOpenChange,
  contractId,
  amount,
  currency,
  description,
  freelancerUserId,
  onPaymentComplete,
}: ContractFundingModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [companyWallet, setCompanyWallet] = useState<CompanyWallet | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState("");

  // PIX payment state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    qrCode: string;
    qrCodeBase64: string;
    expiresAt: string;
    ticketUrl?: string;
  } | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState("");
  const [pixAmount, setPixAmount] = useState(0);

  // Card payment state (Mercado Pago)
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardAmountCents, setCardAmountCents] = useState(0);

  // Stripe card payment state
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);

  // Credits payment state
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsSuccess, setCreditsSuccess] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  const amountCents = Math.round(amount * 100);
  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseMercadoPagoCard = isBRL && mpPublicKey.length > 0;
  const canUseStripeCard = !isBRL; // Stripe for international currencies
  const hasEnoughCredits = companyWallet && companyWallet.balance_cents >= amountCents;

  useEffect(() => {
    if (user && open) {
      fetchUserData();
      setCreditsSuccess(false);
      setCreditsError(null);
      // Set initial payment method based on currency
      if (isBRL) {
        setPaymentMethod("pix");
      } else {
        setPaymentMethod("card");
      }
    }
  }, [user, open, isBRL]);

  // Fetch MercadoPago public key
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

  const fetchUserData = async () => {
    if (!user) return;

    // Fetch company country
    const { data: companyProfile } = await supabase
      .from("company_profiles")
      .select("country")
      .eq("user_id", user.id)
      .single();

    if (companyProfile?.country) {
      setCountry(companyProfile.country);
    }

    // Fetch company wallet balance
    const { data: wallet } = await supabase
      .from("company_wallets")
      .select("balance_cents, currency")
      .eq("company_user_id", user.id)
      .single();

    if (wallet) {
      setCompanyWallet(wallet);
    } else {
      // No wallet exists, set to zero
      setCompanyWallet({ balance_cents: 0, currency: currency || "USD" });
    }
  };

  const handlePayWithCredits = async () => {
    if (!user || !hasEnoughCredits) return;

    setCreditsLoading(true);
    setCreditsError(null);

    try {
      console.log("[ContractFundingModal] Paying with credits", { contractId, amount: amountCents });

      const { data, error } = await supabase.functions.invoke("fund-contract-with-credits", {
        body: {
          contractId,
          amountCents,
          freelancerUserId,
          description,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setCreditsSuccess(true);
        toast.success("Contrato financiado com sucesso!");
        setTimeout(() => {
          onOpenChange(false);
          onPaymentComplete();
        }, 1500);
      } else {
        throw new Error(data?.error || "Erro ao financiar contrato");
      }
    } catch (error) {
      console.error("[ContractFundingModal] Credits payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
      setCreditsError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreditsLoading(false);
    }
  };

  const handlePayWithPix = async () => {
    setLoading(true);

    try {
      console.log("[ContractFundingModal] Creating PIX payment", { contractId, amount: amountCents });

      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents,
          contractId,
          freelancerUserId,
          description: `Financiar: ${description}`,
        },
      });

      if (error) throw error;

      if (data?.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixAmount(data.amount);
        onOpenChange(false);
        setPixModalOpen(true);
      }
    } catch (error) {
      console.error("[ContractFundingModal] PIX error:", error);
      toast.error("Erro ao gerar PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCard = async () => {
    if (isBRL && canUseMercadoPagoCard) {
      // Mercado Pago card for BRL
      console.log("[ContractFundingModal] Opening MP card modal", { contractId, amount: amountCents });
      setCardAmountCents(amountCents);
      onOpenChange(false);
      setCardModalOpen(true);
    } else if (canUseStripeCard) {
      // Stripe card for international currencies
      console.log("[ContractFundingModal] Creating Stripe PaymentIntent", { contractId, amount: amountCents, currency });
      setStripeLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-stripe-payment-intent", {
          body: {
            amountCents,
            currency,
            contractId,
            description: `Financiar: ${description}`,
            paymentType: "contract_funding",
          },
        });

        if (error) throw error;

        if (data?.clientSecret) {
          setStripeClientSecret(data.clientSecret);
          onOpenChange(false);
          setStripeModalOpen(true);
        } else {
          throw new Error("Failed to get client secret");
        }
      } catch (error) {
        console.error("[ContractFundingModal] Stripe error:", error);
        toast.error("Erro ao iniciar pagamento. Tente novamente.");
      } finally {
        setStripeLoading(false);
      }
    }
  };

  const handlePaymentConfirmed = () => {
    toast.success("Pagamento confirmado! Contrato financiado.");
    setPixModalOpen(false);
    setCardModalOpen(false);
    setStripeModalOpen(false);
    setStripeClientSecret("");
    setPixData(null);
    onPaymentComplete();
  };

  const handleRegeneratePixPayment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents,
          contractId,
          freelancerUserId,
          description: `Financiar: ${description}`,
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
      console.error("[ContractFundingModal] PIX regenerate error:", error);
      toast.error("Erro ao gerar novo PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (paymentMethod === "credits") {
      handlePayWithCredits();
    } else if (paymentMethod === "pix") {
      handlePayWithPix();
    } else if (paymentMethod === "card") {
      handlePayWithCard();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              {t("payments.fundContract", "Financiar Contrato")}
            </DialogTitle>
            <DialogDescription>
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount Display */}
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">
                {t("payments.amountToFund", "Valor a financiar")}
              </p>
              <p className="text-3xl font-bold text-primary">
                {formatMoney(amount, currency)}
              </p>
            </div>

            {/* Success State */}
            {creditsSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 font-medium">Contrato financiado com sucesso!</p>
              </div>
            )}

            {/* Error State */}
            {creditsError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-800 font-medium">Erro no pagamento</p>
                </div>
                <p className="text-red-700 text-sm mt-1">{creditsError}</p>
              </div>
            )}

            {/* Payment Method Selection */}
            {!creditsSuccess && (
              <div className="space-y-3">
                <Label>{t("payments.paymentMethod", "Forma de pagamento")}</Label>
                <div className="grid gap-3">
                  {/* Credits Option - Always show */}
                  <button
                    onClick={() => setPaymentMethod("credits")}
                    disabled={!hasEnoughCredits}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3
                      ${paymentMethod === "credits" && hasEnoughCredits
                        ? "border-primary bg-primary/5"
                        : !hasEnoughCredits
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:border-primary/50"
                      }
                    `}
                  >
                    <Wallet className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {t("payments.useCredits", "Créditos em conta")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("payments.availableBalance", "Saldo disponível")}: {formatMoney((companyWallet?.balance_cents || 0) / 100, companyWallet?.currency || currency)}
                      </p>
                      {!hasEnoughCredits && (
                        <p className="text-xs text-destructive mt-1">
                          {t("payments.insufficientBalance", "Saldo insuficiente")}
                        </p>
                      )}
                    </div>
                    {hasEnoughCredits && paymentMethod === "credits" && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </button>

                  {/* PIX Option */}
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
                      <div className="flex-1">
                        <p className="font-medium">PIX</p>
                        <p className="text-xs text-muted-foreground">
                          {t("payments.instant", "Pagamento instantâneo")}
                        </p>
                      </div>
                      {paymentMethod === "pix" && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  )}

                  {/* Card Option */}
                  {(canUseMercadoPagoCard || canUseStripeCard) && (
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
                      <div className="flex-1">
                        <p className="font-medium">
                          {t("payments.card", "Cartão")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("payments.creditDebit", "Crédito ou débito")}
                        </p>
                      </div>
                      {paymentMethod === "card" && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            {!creditsSuccess && (
              <Button
                onClick={handleSubmit}
                disabled={loading || creditsLoading || stripeLoading || !paymentMethod || (paymentMethod === "credits" && !hasEnoughCredits)}
                className="w-full"
                size="lg"
              >
                {loading || creditsLoading || stripeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : paymentMethod === "credits" ? (
                  <Wallet className="h-4 w-4 mr-2" />
                ) : paymentMethod === "pix" ? (
                  <QrCode className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {loading || creditsLoading || stripeLoading
                  ? t("common.processing", "Processando...")
                  : paymentMethod === "credits"
                  ? t("payments.payWithCredits", "Pagar com Créditos")
                  : paymentMethod === "pix"
                  ? t("payments.generatePix", "Gerar QR Code PIX")
                  : t("payments.payWithCard", "Pagar com Cartão")
                }
              </Button>
            )}
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

      {/* Card Payment Modal (Mercado Pago - BRL) */}
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={cardAmountCents}
        publicKey={mpPublicKey}
        paymentType="contract_funding"
        userType="company"
        description={`Financiar: ${description}`}
        currency={currency}
        onPaymentConfirmed={handlePaymentConfirmed}
      />

      {/* Stripe Card Modal (International currencies) */}
      <StripeCardModal
        open={stripeModalOpen}
        onOpenChange={setStripeModalOpen}
        clientSecret={stripeClientSecret}
        amount={amountCents}
        currency={currency}
        description={`Financiar: ${description}`}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}
