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
import { Loader2, CreditCard, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";

// Cache for Stripe instance
let stripePromiseCache: Promise<Stripe | null> | null = null;
let cachedPublishableKey: string | null = null;

async function fetchPublishableKey(): Promise<string | null> {
  // Return cached key if available
  if (cachedPublishableKey) {
    return cachedPublishableKey;
  }

  // Try env variable first (for local development)
  const envKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
  if (envKey && envKey.startsWith("pk_")) {
    console.log("[StripeCardModal] Using Stripe key from env");
    cachedPublishableKey = envKey;
    return envKey;
  }

  // Fetch from Edge Function (for production)
  try {
    console.log("[StripeCardModal] Fetching Stripe key from backend...");
    const { data, error } = await supabase.functions.invoke("get-stripe-public-key");
    
    if (error) {
      console.error("[StripeCardModal] Error fetching Stripe key:", error);
      return null;
    }

    if (data?.configured && data?.publishableKey) {
      console.log("[StripeCardModal] Got Stripe key from backend");
      cachedPublishableKey = data.publishableKey;
      return data.publishableKey;
    }

    console.warn("[StripeCardModal] Stripe not configured:", data?.error);
    return null;
  } catch (error) {
    console.error("[StripeCardModal] Error fetching Stripe key:", error);
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

interface CheckoutFormProps {
  amount: number;
  currency: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

function CheckoutForm({ amount, currency, onSuccess, onError }: CheckoutFormProps) {
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
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("[StripeCardModal] Payment error:", error);
        onError(error.message || "Erro ao processar pagamento");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        console.log("[StripeCardModal] Payment succeeded:", paymentIntent.id);
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // 3DS or other action required - Stripe handles this
        console.log("[StripeCardModal] Requires action:", paymentIntent.status);
      }
    } catch (err) {
      console.error("[StripeCardModal] Error:", err);
      onError("Erro inesperado ao processar pagamento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-1">
          {t("payments.amountToPay", "Valor a pagar")}
        </p>
        <p className="text-2xl font-bold text-primary">
          {formatMoney(amount / 100, currency)}
        </p>
      </div>

      {/* Card Form Container - Full form, not just button */}
      <div className="border rounded-lg p-4 bg-background">
        <PaymentElement
          id="payment-element"
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
        <span>{t("payments.securePayment", "Pagamento seguro via Stripe")}</span>
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
            {t("common.processing", "Processando...")}
          </>
        ) : (
          <>
            <CreditCard className="h-4 w-4 mr-2" />
            {t("payments.pay", "Pagar")} {formatMoney(amount / 100, currency)}
          </>
        )}
      </Button>
    </form>
  );
}

interface StripeCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  amount: number; // in cents
  currency: string;
  description?: string;
  onPaymentConfirmed: () => void;
}

export function StripeCardModal({
  open,
  onOpenChange,
  clientSecret,
  amount,
  currency,
  description,
  onPaymentConfirmed,
}: StripeCardModalProps) {
  const { t } = useTranslation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);

  // Load Stripe instance
  useEffect(() => {
    if (open && clientSecret) {
      setStripeLoading(true);
      getStripePromise().then((stripe) => {
        setStripeInstance(stripe);
        setStripeLoading(false);
        if (!stripe) {
          console.error("[StripeCardModal] Failed to load Stripe");
        }
      });
    }
  }, [open, clientSecret]);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      onPaymentConfirmed();
    }, 1500);
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSuccess(false);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  // Don't render if no client secret
  if (!clientSecret) {
    return null;
  }

  const options: StripeElementsOptions = {
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
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t("payments.payWithCard", "Pagar com Cartão")}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          {stripeLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("common.loading", "Carregando...")}
              </p>
            </div>
          ) : !stripeInstance ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <p className="text-amber-800 font-medium">
                  {t("payments.stripeNotConfigured", "Stripe não configurado")}
                </p>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                {t("payments.contactSupport", "Entre em contato com o suporte para configurar pagamentos internacionais.")}
              </p>
            </div>
          ) : success ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-6 flex flex-col items-center justify-center gap-2">
              <CheckCircle className="h-10 w-10 text-green-600" />
              <p className="text-green-800 font-medium text-center">
                {t("payments.paymentSuccess", "Pagamento confirmado!")}
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-800 font-medium">
                    {t("payments.paymentError", "Erro no pagamento")}
                  </p>
                </div>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
              <Button
                onClick={() => setError(null)}
                variant="outline"
                className="w-full"
              >
                {t("common.tryAgain", "Tentar novamente")}
              </Button>
            </div>
          ) : (
            <Elements stripe={stripeInstance} options={options}>
              <CheckoutForm
                amount={amount}
                currency={currency}
                onSuccess={handleSuccess}
                onError={handleError}
              />
            </Elements>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
