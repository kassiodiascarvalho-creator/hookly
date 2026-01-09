import { useState } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
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
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";

// Initialize Stripe with public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground mb-1">
          {t("payments.amountToPay", "Valor a pagar")}
        </p>
        <p className="text-2xl font-bold text-primary">
          {formatMoney(amount / 100, currency)}
        </p>
      </div>

      <div className="border rounded-lg p-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>

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

  if (!clientSecret) {
    return null;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#7c3aed",
        borderRadius: "8px",
      },
    },
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
