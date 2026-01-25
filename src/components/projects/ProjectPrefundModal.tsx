import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  QrCode,
  CreditCard,
  Shield,
  CheckCircle,
  TrendingUp,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney, getCurrencySymbol } from "@/lib/formatMoney";
import { PixPaymentModal } from "@/components/billing/PixPaymentModal";
import { StripeCardModal } from "@/components/billing/StripeCardModal";
import { CardPaymentModal } from "@/components/billing/CardPaymentModal";
import { usePaymentFees, FEE_KEYS, calculatePaymentFee, getPaymentFeeKey } from "@/hooks/usePaymentFees";

type PaymentMethod = "pix" | "card";

interface ProjectPrefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  budgetMax: number;
  currency: string;
  onPrefundComplete: () => void;
  onSkip: () => void;
}

export function ProjectPrefundModal({
  open,
  onOpenChange,
  projectId,
  budgetMax,
  currency,
  onPrefundComplete,
  onSkip,
}: ProjectPrefundModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { getFeePercent, getDisplayPercent, loading: feesLoading } = usePaymentFees();
  
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [prefundAmount, setPrefundAmount] = useState<string>(budgetMax.toString());

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
  const [cardAmount, setCardAmount] = useState(0);

  // Stripe card payment state
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState("");

  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseMercadoPagoCard = isBRL && mpPublicKey.length > 0;
  const canUseStripeCard = !isBRL;

  const numericAmount = parseFloat(prefundAmount) || 0;

  // Calculate fees
  const feeInfo = useMemo(() => {
    if (!paymentMethod || numericAmount <= 0) return null;
    
    const feeKey = getPaymentFeeKey(currency, paymentMethod);
    const feePercent = getFeePercent(feeKey);
    const percentDisplay = getDisplayPercent(feeKey);
    
    let methodName: string;
    if (paymentMethod === "pix") {
      methodName = "PIX";
    } else if (isBRL) {
      methodName = t("payments.fees.brl_card", "Cartão");
    } else {
      methodName = t("payments.fees.international_card", "Cartão Internacional");
    }
    
    const { feeAmount, totalAmount, totalAmountCents } = calculatePaymentFee(numericAmount, feePercent);
    
    return {
      feeKey,
      feePercent,
      methodName,
      percentDisplay,
      feeAmount,
      totalAmount,
      totalAmountCents,
    };
  }, [paymentMethod, numericAmount, currency, isBRL, getFeePercent, getDisplayPercent, t]);

  useEffect(() => {
    if (user && open) {
      fetchUserCountry();
      setPrefundAmount(budgetMax.toString());
      if (isBRL) {
        setPaymentMethod("pix");
      } else {
        setPaymentMethod("card");
      }
    }
  }, [user, open, isBRL, budgetMax]);

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

  const fetchUserCountry = async () => {
    if (!user) return;

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
    if (!feeInfo || numericAmount <= 0) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "project_prefund",
          userType: "company",
          amountCents: feeInfo.totalAmountCents,
          contractAmountCents: Math.round(numericAmount * 100), // Base amount for escrow
          projectId,
          description: t("projects.prefund.pixDescription", "Pré-financiamento de projeto"),
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
      console.error("[ProjectPrefundModal] PIX error:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithCard = async () => {
    if (!feeInfo || numericAmount <= 0) return;

    if (isBRL && canUseMercadoPagoCard) {
      setCardAmount(feeInfo.totalAmount);
      onOpenChange(false);
      setCardModalOpen(true);
    } else if (canUseStripeCard) {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("create-stripe-payment-intent", {
          body: {
            amountCents: feeInfo.totalAmountCents,
            contractAmountCents: Math.round(numericAmount * 100),
            currency,
            projectId,
            description: t("projects.prefund.stripeDescription", "Project Prefunding"),
            paymentType: "project_prefund",
            feePercent: feeInfo.feePercent,
            feeAmountCents: Math.round(feeInfo.feeAmount * 100),
          },
        });

        if (error) throw error;

        if (data?.clientSecret) {
          setStripeClientSecret(data.clientSecret);
          onOpenChange(false);
          setStripeModalOpen(true);
        }
      } catch (error) {
        console.error("[ProjectPrefundModal] Stripe error:", error);
        toast.error(t("common.error"));
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePaymentConfirmed = () => {
    toast.success(t("projects.prefund.success", "Fundos adicionados com sucesso!"));
    setPixModalOpen(false);
    setCardModalOpen(false);
    setStripeModalOpen(false);
    onPrefundComplete();
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("projects.prefund.title", "Empresas com fundos verificados recebem mais propostas")}
            </DialogTitle>
            <DialogDescription className="text-base">
              {t(
                "projects.prefund.description",
                "Adicionar fundos protege o pagamento e aumenta confiança. Recomendamos proteger o valor máximo do orçamento para evitar completar depois."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Benefits */}
            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-700 dark:text-green-400">
                  {t("projects.prefund.benefit1", "Receba até 3x mais propostas")}
                </p>
                <p className="text-green-600 dark:text-green-500">
                  {t(
                    "projects.prefund.benefit2",
                    "Freelancers confiam mais em projetos com pagamento garantido"
                  )}
                </p>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="prefund-amount">
                {t("projects.prefund.amountLabel", "Valor a adicionar")}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {getCurrencySymbol(currency)}
                </span>
                <Input
                  id="prefund-amount"
                  type="number"
                  value={prefundAmount}
                  onChange={(e) => setPrefundAmount(e.target.value)}
                  className="pl-8"
                  min={1}
                  max={budgetMax * 2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("projects.prefund.suggestedAmount", "Sugerido")}: {formatMoney(budgetMax, currency)}
              </p>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-3">
              <Label>{t("payments.paymentMethod", "Forma de pagamento")}</Label>
              <div className="grid gap-3">
                {/* PIX Option */}
                {canUsePix && (
                  <button
                    onClick={() => setPaymentMethod("pix")}
                    className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                      paymentMethod === "pix"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <QrCode className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">PIX</p>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {getDisplayPercent(FEE_KEYS.BRL_PIX)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t("payments.instant")}</p>
                    </div>
                    {paymentMethod === "pix" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </button>
                )}

                {/* Card Option - BRL */}
                {canUseMercadoPagoCard && (
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{t("payments.fees.brl_card", "Cartão")}</p>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {getDisplayPercent(FEE_KEYS.BRL_CARD)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t("payments.creditDebit")}</p>
                    </div>
                    {paymentMethod === "card" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </button>
                )}

                {/* Card Option - International */}
                {canUseStripeCard && (
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3 ${
                      paymentMethod === "card"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{t("payments.fees.international_card", "Cartão Internacional")}</p>
                        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {getDisplayPercent(FEE_KEYS.INTERNATIONAL_CARD)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                    </div>
                    {paymentMethod === "card" && <CheckCircle className="h-5 w-5 text-primary" />}
                  </button>
                )}
              </div>
            </div>

            {/* Fee Breakdown */}
            {feeInfo && paymentMethod && numericAmount > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  {t("payments.feeLabels.paymentSummary", "Resumo do Pagamento")}
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("payments.feeLabels.baseAmount", "Valor base")}
                    </span>
                    <span>{formatMoney(numericAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t("payments.protectionFee", "Proteção")} ({feeInfo.percentDisplay})
                    </span>
                    <span>{formatMoney(feeInfo.feeAmount, currency)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>{t("payments.feeLabels.totalToPay", "Total a pagar")}</span>
                    <span className="text-primary">{formatMoney(feeInfo.totalAmount, currency)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={onSkip}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {t("projects.prefund.skip", "Publicar sem fundos")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || numericAmount <= 0 || !paymentMethod}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              {t("projects.prefund.addFunds", "Adicionar fundos agora")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PIX Modal */}
      <PixPaymentModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        pixData={pixData}
        paymentId={pixPaymentId}
        amount={pixAmount}
        onPaymentConfirmed={handlePaymentConfirmed}
        onRegeneratePayment={handlePayWithPix}
      />

      {/* Mercado Pago Card Modal */}
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={cardAmount}
        publicKey={mpPublicKey}
        paymentType="project_prefund"
        userType="company"
        currency={currency}
        description={t("projects.prefund.cardDescription", "Pré-financiamento de projeto")}
        onPaymentConfirmed={handlePaymentConfirmed}
        onError={(error) => {
          toast.error(error);
          setCardModalOpen(false);
        }}
      />

      {/* Stripe Card Modal */}
      <StripeCardModal
        open={stripeModalOpen}
        onOpenChange={setStripeModalOpen}
        clientSecret={stripeClientSecret}
        amount={feeInfo?.totalAmountCents || Math.round(numericAmount * 100)}
        currency={currency}
        description={t("projects.prefund.stripeDescription", "Project Prefunding")}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}

export default ProjectPrefundModal;
