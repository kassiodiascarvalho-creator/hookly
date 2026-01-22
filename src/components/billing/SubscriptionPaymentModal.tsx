import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe, Stripe, StripeElementsOptions } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Lock, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_PLANS, type PlanConfig } from "@/hooks/useCompanyPlan";

// Cache for Stripe instance
let stripePromiseCache: Promise<Stripe | null> | null = null;
let cachedPublishableKey: string | null = null;

async function fetchPublishableKey(): Promise<string | null> {
  if (cachedPublishableKey) {
    return cachedPublishableKey;
  }

  const envKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  if (envKey && envKey.startsWith("pk_")) {
    cachedPublishableKey = envKey;
    return envKey;
  }

  try {
    const { data, error } = await supabase.functions.invoke("get-stripe-public-key");
    
    if (error) {
      console.error("[SubscriptionPaymentModal] Error fetching Stripe key:", error);
      return null;
    }

    if (data?.configured && data?.publishableKey) {
      cachedPublishableKey = data.publishableKey;
      return data.publishableKey;
    }

    return null;
  } catch (error) {
    console.error("[SubscriptionPaymentModal] Error fetching Stripe key:", error);
    return null;
  }
}

async function getStripePromise(): Promise<Stripe | null> {
  if (stripePromiseCache) {
    return stripePromiseCache;
  }

  const publishableKey = await fetchPublishableKey();
  if (!publishableKey) {
    return null;
  }

  stripePromiseCache = loadStripe(publishableKey);
  return stripePromiseCache;
}

interface SubscriptionFormProps {
  planName: string;
  amount: number;
  intentType: "setup" | "payment";
  onSetupComplete: (paymentMethodId: string) => Promise<void>;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function SubscriptionForm({ planName, amount, intentType, onSetupComplete, onSuccess, onError }: SubscriptionFormProps) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      if (intentType === "setup") {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/finances?subscription=setup`,
          },
          redirect: "if_required",
        });

        if (error) {
          console.error("[SubscriptionPaymentModal] Setup error:", error);
          onError(error.message || "Erro ao validar cartão");
          return;
        }

        if (!setupIntent || setupIntent.status !== "succeeded") {
          onError("Não foi possível validar o cartão");
          return;
        }

        const paymentMethodId = setupIntent.payment_method;
        if (!paymentMethodId || typeof paymentMethodId !== "string") {
          onError("Cartão validado, mas não foi possível obter o método de pagamento");
          return;
        }

        await onSetupComplete(paymentMethodId);
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/finances?subscription=success`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("[SubscriptionPaymentModal] Payment error:", error);
        onError(error.message || "Erro ao processar pagamento");
      } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
        console.log("[SubscriptionPaymentModal] Payment succeeded:", paymentIntent.id);
        onSuccess();
      }
    } catch (err) {
      console.error("[SubscriptionPaymentModal] Error:", err);
      onError("Erro inesperado ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan Info */}
      <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
        <Badge variant="secondary" className="mb-2">
          <Sparkles className="h-3 w-3 mr-1" />
          Assinatura Mensal
        </Badge>
        <p className="text-lg font-semibold text-foreground">{planName}</p>
        <p className="text-2xl font-bold text-primary mt-1">
          {formatMoney(amount / 100, "BRL")}/mês
        </p>
      </div>

      {/* Card Form */}
      <div className="border rounded-lg p-4 bg-background">
        <PaymentElement
          id="subscription-payment-element"
          options={{
            layout: {
              type: "accordion",
              defaultCollapsed: false,
              radios: false,
              spacedAccordionItems: true,
            },
            fields: {
              billingDetails: {
                address: {
                  country: "auto",
                },
              },
            },
            wallets: {
              applePay: "auto",
              googlePay: "auto",
            },
          }}
        />
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>Pagamento seguro via Stripe • Cancele a qualquer momento</span>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processando...
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            {intentType === "setup"
              ? "Continuar"
              : `Assinar ${formatMoney(amount / 100, "BRL")}/mês`}
          </>
        )}
      </Button>
    </form>
  );
}

interface SubscriptionPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planType: "starter" | "pro" | "elite";
  onSubscriptionConfirmed: () => void;
}

export function SubscriptionPaymentModal({
  open,
  onOpenChange,
  planType,
  onSubscriptionConfirmed,
}: SubscriptionPaymentModalProps) {
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] = useState<{
    planName: string;
    amount: number;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [intentType, setIntentType] = useState<"setup" | "payment">("setup");

  const planConfig = COMPANY_PLANS.find((p) => p.type === planType);

  // Create subscription intent when modal opens
  useEffect(() => {
    if (open && planType && !clientSecret) {
      createSubscriptionIntent();
    }
  }, [open, planType]);

  // Load Stripe instance
  useEffect(() => {
    if (open && clientSecret) {
      setStripeLoading(true);
      getStripePromise().then((stripe) => {
        setStripeInstance(stripe);
        setStripeLoading(false);
      });
    }
  }, [open, clientSecret]);

  const createSubscriptionIntent = async () => {
    try {
      setCreating(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke("create-subscription-intent", {
        body: { planType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
      setIntentType((data.intentType as "setup" | "payment") || "setup");
      setSubscriptionData({
        planName: data.planName,
        amount: data.amount,
      });
    } catch (err) {
      console.error("[SubscriptionPaymentModal] Error creating intent:", err);
      setError(err instanceof Error ? err.message : "Erro ao criar assinatura");
    } finally {
      setCreating(false);
    }
  };

  const createSubscriptionFromPaymentMethod = async (paymentMethodId: string) => {
    try {
      setCreating(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke("create-subscription-intent", {
        body: { planType, paymentMethodId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setClientSecret(data.clientSecret);
      setIntentType("payment");
      setSubscriptionData({
        planName: data.planName,
        amount: data.amount,
      });
    } catch (err) {
      console.error("[SubscriptionPaymentModal] Error creating subscription:", err);
      setError(err instanceof Error ? err.message : "Erro ao criar assinatura");
    } finally {
      setCreating(false);
    }
  };

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      onSubscriptionConfirmed();
    }, 2000);
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSuccess(false);
      setError(null);
      setClientSecret(null);
      setSubscriptionData(null);
      setIntentType("setup");
    }
    onOpenChange(isOpen);
  };

  const options: StripeElementsOptions | null = clientSecret ? {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#7c3aed",
        colorBackground: "#ffffff",
        colorText: "#1f2937",
        colorDanger: "#ef4444",
        fontFamily: "Inter, system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
        fontSizeBase: "16px",
      },
      rules: {
        ".Input": {
          border: "1px solid #e5e7eb",
          boxShadow: "none",
          padding: "12px",
        },
        ".Input:focus": {
          border: "1px solid #7c3aed",
          boxShadow: "0 0 0 1px #7c3aed",
        },
        ".Label": {
          fontWeight: "500",
          marginBottom: "8px",
        },
        ".Tab": {
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        },
        ".Tab--selected": {
          border: "2px solid #7c3aed",
          backgroundColor: "#f5f3ff",
        },
      },
    },
    locale: "pt-BR",
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Assinar {planConfig?.name || "Plano"}
          </DialogTitle>
          <DialogDescription>
            Pagamento recorrente mensal. Cancele a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        {/* Success State */}
        {success && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Assinatura ativada!</h3>
            <p className="text-muted-foreground text-sm">
              Seu plano {subscriptionData?.planName} já está ativo.
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !success && (
          <div className="py-4">
            <div className="p-4 bg-destructive/10 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Erro</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                setError(null);
                setClientSecret(null);
                createSubscriptionIntent();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Loading State */}
        {(creating || stripeLoading) && !error && !success && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Preparando pagamento...</p>
          </div>
        )}

        {/* Payment Form */}
        {!creating && !stripeLoading && !error && !success && clientSecret && stripeInstance && options && subscriptionData && (
          <Elements key={clientSecret} stripe={stripeInstance} options={options}>
            <SubscriptionForm
              planName={subscriptionData.planName}
              amount={subscriptionData.amount}
              intentType={intentType}
              onSetupComplete={createSubscriptionFromPaymentMethod}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
}
