import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, QrCode, CreditCard, Wallet, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { PixPaymentModal } from "@/components/billing/PixPaymentModal";
import { CardPaymentModal } from "@/components/billing/CardPaymentModal";
import { StripeCardModal } from "@/components/billing/StripeCardModal";
import { isCurrencyAllowed, getAllowedCurrencies } from "@/lib/currencyByCountry";

type PaymentMethod = "pix" | "card";

// Payment method fees (percentage)
const PAYMENT_FEES = {
  pix: 0.02,           // 2% for PIX
  card_br: 0.06,       // 6% for Brazilian card (Mercado Pago)
  card_intl: 0.15,     // 15% for international card (Stripe)
};

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

  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseMercadoPagoCard = isBRL && mpPublicKey.length > 0;
  const canUseStripeCard = !isBRL; // Stripe for international currencies

  // Calculate fees based on selected payment method
  const feeInfo = useMemo(() => {
    if (!paymentMethod) return null;
    
    let feePercent: number;
    let methodName: string;
    let percentDisplay: string;
    
    if (paymentMethod === "pix") {
      feePercent = PAYMENT_FEES.pix;
      methodName = "PIX";
      percentDisplay = "2%";
    } else if (isBRL) {
      feePercent = PAYMENT_FEES.card_br;
      methodName = "Cartão";
      percentDisplay = "6%";
    } else {
      feePercent = PAYMENT_FEES.card_intl;
      methodName = "Cartão Internacional";
      percentDisplay = "15%";
    }
    
    const feeAmount = amount * feePercent;
    const totalAmount = amount + feeAmount;
    const totalAmountCents = Math.round(totalAmount * 100);
    
    // Format: "Taxa do método (PIX 2%)" or "Taxa do método (Cartão 6%)"
    const feeLabel = `Taxa do método (${methodName} ${percentDisplay})`;
    
    return {
      feePercent,
      feeLabel,
      methodName,
      percentDisplay,
      feeAmount,
      totalAmount,
      totalAmountCents,
    };
  }, [paymentMethod, amount, isBRL]);

  // Check if project currency is allowed for user's country
  const isCurrencyAllowedForUser = isCurrencyAllowed(currency, country);
  const allowedCurrencies = getAllowedCurrencies(country);

  useEffect(() => {
    if (user && open) {
      fetchUserData();
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
  };

  const handlePayWithPix = async () => {
    if (!feeInfo) return;
    setLoading(true);

    try {
      console.log("[ContractFundingModal] Creating PIX payment", { 
        contractId, 
        contractAmountCents: Math.round(amount * 100),
        totalWithFeeCents: feeInfo.totalAmountCents,
        feePercent: feeInfo.feePercent 
      });

      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents: feeInfo.totalAmountCents, // Total including fee
          contractAmountCents: Math.round(amount * 100), // Original contract amount
          contractId,
          freelancerUserId,
          description: `Financiar: ${description}`,
          feePercent: feeInfo.feePercent,
          feeAmountCents: Math.round(feeInfo.feeAmount * 100),
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
    if (!feeInfo) return;
    
    if (isBRL && canUseMercadoPagoCard) {
      // Mercado Pago card for BRL
      console.log("[ContractFundingModal] Opening MP card modal", { 
        contractId, 
        totalWithFeeCents: feeInfo.totalAmountCents 
      });
      setCardAmountCents(feeInfo.totalAmountCents);
      onOpenChange(false);
      setCardModalOpen(true);
    } else if (canUseStripeCard) {
      // Stripe card for international currencies
      console.log("[ContractFundingModal] Creating Stripe PaymentIntent", { 
        contractId, 
        totalWithFeeCents: feeInfo.totalAmountCents, 
        currency 
      });
      setStripeLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-stripe-payment-intent", {
          body: {
            amountCents: feeInfo.totalAmountCents, // Total including fee
            contractAmountCents: Math.round(amount * 100), // Original contract amount
            currency,
            contractId,
            description: `Financiar: ${description}`,
            paymentType: "contract_funding",
            feePercent: feeInfo.feePercent,
            feeAmountCents: Math.round(feeInfo.feeAmount * 100),
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
    if (!feeInfo) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents: feeInfo.totalAmountCents,
          contractAmountCents: Math.round(amount * 100),
          contractId,
          freelancerUserId,
          description: `Financiar: ${description}`,
          feePercent: feeInfo.feePercent,
          feeAmountCents: Math.round(feeInfo.feeAmount * 100),
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
    if (paymentMethod === "pix") {
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

            {/* Currency Restriction Warning */}
            {!isCurrencyAllowedForUser && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-amber-800 font-medium">
                      {t("payments.currencyNotAllowed", "Moeda não permitida")}
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      {t(
                        "payments.currencyRestrictionMessage", 
                        `A moeda ${currency} não é permitida para seu país. Moedas permitidas: ${allowedCurrencies.join(", ")}.`
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            {isCurrencyAllowedForUser && (
              <div className="space-y-3">
                <Label>{t("payments.paymentMethod", "Forma de pagamento")}</Label>
                <div className="grid gap-3">
                  {/* PIX Option - Only show for BRL */}
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
                        <div className="flex items-center justify-between">
                          <p className="font-medium">PIX</p>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Taxa do método: 2%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("payments.instant", "Pagamento instantâneo")}
                        </p>
                      </div>
                      {paymentMethod === "pix" && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  )}

                  {/* Card Option - BRL */}
                  {canUseMercadoPagoCard && (
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
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{t("payments.card", "Cartão")}</p>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Taxa do método: 6%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("payments.creditDebit", "Crédito ou débito")}
                        </p>
                      </div>
                      {paymentMethod === "card" && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </button>
                  )}

                  {/* Card Option - International */}
                  {canUseStripeCard && (
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
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{t("payments.cardInternational", "Cartão Internacional")}</p>
                          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            Taxa do método: 15%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Visa, Mastercard, Amex
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

            {/* Fee Breakdown */}
            {isCurrencyAllowedForUser && feeInfo && paymentMethod && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Resumo do Pagamento
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor do contrato</span>
                    <span className="font-medium">{formatMoney(amount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {feeInfo.feeLabel}
                    </span>
                    <span className="text-amber-600 font-medium">
                      +{formatMoney(feeInfo.feeAmount, currency)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total a pagar</span>
                    <span className="text-primary">
                      {formatMoney(feeInfo.totalAmount, currency)}
                    </span>
                  </div>
                </div>
                
                {/* Freelancer amount highlight */}
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                      O freelancer receberá exatamente {formatMoney(amount, currency)} após a conclusão.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {isCurrencyAllowedForUser && (
              <Button
                onClick={handleSubmit}
                disabled={loading || stripeLoading || !paymentMethod}
                className="w-full"
                size="lg"
              >
                {loading || stripeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : paymentMethod === "pix" ? (
                  <QrCode className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {loading || stripeLoading
                  ? t("payments.processing", "Processando...")
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

      {/* Card Payment Modal (Mercado Pago) */}
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={cardAmountCents}
        publicKey={mpPublicKey}
        paymentType="contract_funding"
        userType="company"
        contractId={contractId}
        description={`Financiar: ${description}`}
        onPaymentConfirmed={handlePaymentConfirmed}
      />

      {/* Stripe Card Modal */}
      {stripeClientSecret && feeInfo && (
        <StripeCardModal
          open={stripeModalOpen}
          onOpenChange={setStripeModalOpen}
          clientSecret={stripeClientSecret}
          amount={feeInfo.totalAmountCents}
          currency={currency}
          description={`Financiar: ${description}`}
          onPaymentConfirmed={handlePaymentConfirmed}
        />
      )}
    </>
  );
}
