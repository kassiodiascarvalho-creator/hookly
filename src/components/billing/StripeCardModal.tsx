import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
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

// Initialize Stripe with public key
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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

  // Don't render if no client secret or Stripe not initialized
  if (!clientSecret) {
    return null;
  }

  if (!stripePromise) {
    console.error("[StripeCardModal] Stripe publishable key is not configured");
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
          {success ? (
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
            <Elements stripe={stripePromise} options={options}>
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
