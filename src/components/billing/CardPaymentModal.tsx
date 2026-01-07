import { useState, useEffect, useCallback } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { Loader2, CreditCard, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";

interface CardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number; // in cents
  publicKey: string;
  paymentType: string;
  userType: string;
  creditsAmount?: number;
  description?: string;
  fallbackUrl?: string;
  onPaymentConfirmed?: () => void;
  onError?: (error: string) => void;
}

interface CardFormData {
  token: string;
  issuer_id: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: {
    email: string;
    identification: {
      type: string;
      number: string;
    };
  };
}

export function CardPaymentModal({
  open,
  onOpenChange,
  amount,
  publicKey,
  paymentType,
  userType,
  creditsAmount,
  description,
  fallbackUrl,
  onPaymentConfirmed,
  onError,
}: CardPaymentModalProps) {
  const [processing, setProcessing] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickError, setBrickError] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "approved" | "rejected" | null>(null);

  // Initialize MercadoPago SDK
  useEffect(() => {
    if (open && publicKey) {
      try {
        initMercadoPago(publicKey, { locale: "pt-BR" });
        setSdkReady(true);
        setBrickError(false);
      } catch (error) {
        console.error("Error initializing MercadoPago SDK:", error);
        setBrickError(true);
      }
    }
  }, [open, publicKey]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setProcessing(false);
      setPaymentStatus(null);
      setBrickError(false);
    }
  }, [open]);

  const handleSubmit = useCallback(async (formData: CardFormData) => {
    setProcessing(true);
    setBrickError(false);

    try {
      const { data, error } = await supabase.functions.invoke("create-card-payment", {
        body: {
          token: formData.token,
          paymentMethodId: formData.payment_method_id,
          issuerId: formData.issuer_id,
          installments: formData.installments,
          transactionAmount: formData.transaction_amount,
          payerEmail: formData.payer.email,
          payerDocType: formData.payer.identification?.type,
          payerDocNumber: formData.payer.identification?.number,
          paymentType,
          userType,
          amountCents: amount,
          creditsAmount,
          description,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao processar pagamento");
      }

      if (data?.status === "approved") {
        setPaymentStatus("approved");
        toast.success("Pagamento aprovado!");
        setTimeout(() => {
          onPaymentConfirmed?.();
          onOpenChange(false);
        }, 1500);
      } else if (data?.status === "pending" || data?.status === "in_process") {
        setPaymentStatus("pending");
        toast.info("Pagamento em análise. Você será notificado quando for confirmado.");
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        setPaymentStatus("rejected");
        const statusDetail = data?.statusDetail || "unknown";
        let errorMessage = "Pagamento recusado.";
        
        // Map common rejection reasons
        if (statusDetail === "cc_rejected_insufficient_amount") {
          errorMessage = "Saldo insuficiente no cartão.";
        } else if (statusDetail === "cc_rejected_bad_filled_security_code") {
          errorMessage = "CVV incorreto.";
        } else if (statusDetail === "cc_rejected_bad_filled_card_number") {
          errorMessage = "Número do cartão inválido.";
        } else if (statusDetail === "cc_rejected_bad_filled_date") {
          errorMessage = "Data de validade inválida.";
        } else if (statusDetail === "cc_rejected_high_risk") {
          errorMessage = "Pagamento recusado por segurança.";
        } else if (statusDetail === "cc_rejected_call_for_authorize") {
          errorMessage = "Entre em contato com seu banco para autorizar.";
        }

        toast.error(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error("Card payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
      toast.error(errorMessage);
      setBrickError(true);
      onError?.(errorMessage);
    } finally {
      setProcessing(false);
    }
  }, [amount, paymentType, userType, creditsAmount, description, onPaymentConfirmed, onOpenChange, onError]);

  const handleBrickError = useCallback((error: unknown) => {
    console.error("Brick error:", error);
    setBrickError(true);
  }, []);

  const handleFallback = () => {
    if (fallbackUrl) {
      window.location.href = fallbackUrl;
    }
  };

  const amountValue = amount / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamento com Cartão
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do seu cartão de crédito ou débito
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Valor a pagar</p>
            <p className="text-3xl font-bold text-primary">
              {formatMoney(amountValue, "BRL")}
            </p>
          </div>

          {/* Payment Status Messages */}
          {paymentStatus === "approved" && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-green-800 font-medium">✓ Pagamento aprovado!</p>
            </div>
          )}

          {paymentStatus === "pending" && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
              <p className="text-yellow-800 font-medium">Pagamento em análise...</p>
            </div>
          )}

          {paymentStatus === "rejected" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-red-800 font-medium">Pagamento recusado</p>
              <p className="text-red-600 text-sm mt-1">Tente novamente ou use outro cartão</p>
            </div>
          )}

          {/* Card Payment Brick */}
          {!paymentStatus && !brickError && sdkReady && (
            <div className="min-h-[350px]">
              {processing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <CardPayment
                initialization={{
                  amount: amountValue,
                }}
                onSubmit={handleSubmit}
                onError={handleBrickError}
                customization={{
                  paymentMethods: {
                    maxInstallments: 12,
                  },
                  visual: {
                    style: {
                      theme: "default",
                    },
                  },
                }}
              />
            </div>
          )}

          {/* Loading SDK */}
          {!sdkReady && !brickError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Carregando formulário...</p>
            </div>
          )}

          {/* Brick Error - Show Fallback */}
          {brickError && !paymentStatus && (
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 font-medium">
                      Erro ao carregar formulário
                    </p>
                    <p className="text-yellow-700 text-sm mt-1">
                      Ocorreu um problema ao carregar o formulário de pagamento. 
                      Você pode tentar novamente ou pagar pelo site do Mercado Pago.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSdkReady(false);
                    setBrickError(false);
                    setTimeout(() => {
                      try {
                        initMercadoPago(publicKey, { locale: "pt-BR" });
                        setSdkReady(true);
                      } catch {
                        setBrickError(true);
                      }
                    }, 500);
                  }}
                >
                  Tentar novamente
                </Button>
                
                {fallbackUrl && (
                  <Button
                    variant="secondary"
                    onClick={handleFallback}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Pagar no Mercado Pago (alternativo)
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
