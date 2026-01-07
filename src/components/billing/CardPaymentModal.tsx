import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
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

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface CardPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number; // in cents
  publicKey: string;
  paymentType: string;
  userType: string;
  creditsAmount?: number;
  description?: string;
  currency?: string;
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

export const CardPaymentModal = forwardRef<HTMLDivElement, CardPaymentModalProps>(
  function CardPaymentModal(
    {
      open,
      onOpenChange,
      amount,
      publicKey,
      paymentType,
      userType,
      creditsAmount,
      description,
      currency = "BRL",
      onPaymentConfirmed,
      onError,
    },
    ref
  ) {
    const [processing, setProcessing] = useState(false);
    const [sdkReady, setSdkReady] = useState(false);
    const [brickError, setBrickError] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
    const [loadingFallback, setLoadingFallback] = useState(false);
    const [brickMounted, setBrickMounted] = useState(false);
    const brickControllerRef = useRef<any>(null);
    const initAttemptedRef = useRef(false);

    const amountValue = amount / 100;

    // Cleanup function
    const cleanupBrick = useCallback(() => {
      if (brickControllerRef.current) {
        try {
          brickControllerRef.current.unmount();
          console.log("[CardPaymentModal] Brick unmounted");
        } catch (e) {
          console.log("[CardPaymentModal] Error during cleanup:", e);
        }
        brickControllerRef.current = null;
      }
      setBrickMounted(false);
    }, []);

    // Reset state when modal closes
    useEffect(() => {
      if (!open) {
        cleanupBrick();
        setProcessing(false);
        setPaymentStatus(null);
        setBrickError(null);
        setSdkReady(false);
        setLoadingFallback(false);
        initAttemptedRef.current = false;
      }
    }, [open, cleanupBrick]);

    // Container ref for DOM readiness check
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize MercadoPago SDK and mount Brick when container is ready
    useEffect(() => {
      if (!open || !publicKey || initAttemptedRef.current) return;

      console.log("[CardPaymentModal] === INITIALIZATION START ===");
      
      // Log 1: SDK loaded
      const sdkLoaded = typeof window.MercadoPago !== "undefined";
      console.log("[CardPaymentModal] SDK loaded:", sdkLoaded);
      
      if (!sdkLoaded) {
        console.error("[CardPaymentModal] MercadoPago SDK not available on window");
        setBrickError("SDK do Mercado Pago não foi carregado. Recarregue a página.");
        return;
      }

      // Log 2: mpPublicKey loaded
      console.log("[CardPaymentModal] mpPublicKey loaded:", !!publicKey);

      // Wait for container to be ready using polling instead of fixed delay
      const checkContainerReady = () => {
        const container = document.getElementById("cardPaymentBrick_container");
        if (container && open) {
          console.log("[CardPaymentModal] Container ready, proceeding with initialization");
          initAttemptedRef.current = true;
          initBrick();
        } else if (open) {
          // Container not ready yet, check again
          console.log("[CardPaymentModal] Waiting for container...");
          setTimeout(checkContainerReady, 100);
        }
      };

      // Start checking after a short initial delay to allow React to render
      const initTimer = setTimeout(checkContainerReady, 200);

      return () => {
        clearTimeout(initTimer);
      };
    }, [open, publicKey, amountValue]);

    const initBrick = async () => {
      // Log 3: Initializing Brick
      console.log("[CardPaymentModal] Initializing Brick");

      try {
        const container = document.getElementById("cardPaymentBrick_container");
        if (!container) {
          console.error("[CardPaymentModal] Container not found in DOM");
          setBrickError("Container do formulário não encontrado. Tente novamente.");
          return;
        }

        console.log("[CardPaymentModal] Container found:", container);

        let mp: any;
        let bricksBuilder: any;

        // Determine initialization path based on SDK shape
        if (typeof window.MercadoPago === "function") {
          console.log("[CardPaymentModal] chosenInitPath: constructor");
          
          mp = new window.MercadoPago(publicKey, {
            locale: "pt-BR",
          });
          console.log("[CardPaymentModal] MercadoPago instance created");
          console.log("[CardPaymentModal] mp object:", mp);
          console.log("[CardPaymentModal] mp.bricks type:", typeof mp.bricks);

          if (typeof mp.bricks === "function") {
            bricksBuilder = mp.bricks();
            console.log("[CardPaymentModal] bricksBuilder created via mp.bricks()");
          } else {
            throw new Error("mp.bricks() not available after constructor initialization");
          }
        } else if (typeof window.MercadoPago === "object" && typeof window.MercadoPago.bricks === "function") {
          console.log("[CardPaymentModal] chosenInitPath: direct-bricks");
          bricksBuilder = window.MercadoPago.bricks();
          console.log("[CardPaymentModal] bricksBuilder created via window.MercadoPago.bricks()");
        } else {
          console.error("[CardPaymentModal] Unknown SDK shape");
          console.error("[CardPaymentModal] MercadoPago keys:", Object.keys(window.MercadoPago || {}));
          setBrickError("SDK do Mercado Pago com formato desconhecido.");
          return;
        }

        console.log("[CardPaymentModal] brickCreateStart");

        // Clear container content
        container.innerHTML = "";

        const controller = await bricksBuilder.create(
          "cardPayment",
          "cardPaymentBrick_container",
          {
            initialization: {
              amount: amountValue,
            },
            callbacks: {
              onReady: () => {
                console.log("[CardPaymentModal] Brick ready");
                setSdkReady(true);
                setBrickMounted(true);
                setBrickError(null);
              },
              onSubmit: async (formData: CardFormData) => {
                console.log("[CardPaymentModal] onSubmit called");
                console.log("[CardPaymentModal] Form data:", JSON.stringify(formData, null, 2));
                await handleSubmit(formData);
              },
              onError: (error: any) => {
                console.error("[CardPaymentModal] Brick error:", error);
                console.error("[CardPaymentModal] Error stack:", error?.stack || "no stack");
                setBrickError(error?.message || "Erro no formulário de pagamento");
              },
            },
            customization: {
              paymentMethods: {
                maxInstallments: 12,
                // Allow both credit and debit when available
                types: {
                  included: ["credit_card", "debit_card"],
                },
              },
              visual: {
                style: {
                  theme: "default",
                },
              },
            },
          }
        );

        brickControllerRef.current = controller;
        console.log("[CardPaymentModal] Controller stored successfully");
      } catch (error: any) {
        console.error("[CardPaymentModal] Brick error:", error);
        console.error("[CardPaymentModal] Error message:", error?.message || "unknown");
        console.error("[CardPaymentModal] Error stack:", error?.stack || "no stack");
        setBrickError(error?.message || "Erro ao carregar formulário de pagamento");
      }
    };

    const handleSubmit = useCallback(async (formData: CardFormData) => {
      setProcessing(true);
      setBrickError(null);

      try {
        console.log("[CardPaymentModal] Sending payment to backend");

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

        console.log("[CardPaymentModal] Backend response:", data);

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
        console.error("[CardPaymentModal] Card payment error:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
        toast.error(errorMessage);
        setBrickError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setProcessing(false);
      }
    }, [amount, paymentType, userType, creditsAmount, description, onPaymentConfirmed, onOpenChange, onError]);

    const handleFallback = async () => {
      console.log("[CardPaymentModal] User clicked fallback");
      setLoadingFallback(true);
      
      try {
        const { data, error } = await supabase.functions.invoke("create-unified-payment", {
          body: {
            paymentType,
            userType,
            amountCents: amount,
            currency,
            creditsAmount,
            description,
          },
        });

        if (error) throw error;

        if (data?.url) {
          console.log("[CardPaymentModal] Redirecting to fallback URL");
          window.location.href = data.url;
        } else {
          toast.error("Erro ao gerar link de pagamento alternativo");
        }
      } catch (err) {
        console.error("[CardPaymentModal] Error generating fallback URL:", err);
        toast.error("Erro ao gerar link de pagamento alternativo");
      } finally {
        setLoadingFallback(false);
      }
    };

    const handleRetry = () => {
      console.log("[CardPaymentModal] Retrying brick initialization");
      cleanupBrick();
      setSdkReady(false);
      setBrickError(null);
      initAttemptedRef.current = false;
      
      // Force remount by closing and reopening
      onOpenChange(false);
      setTimeout(() => onOpenChange(true), 100);
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" ref={ref}>
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

            {/* Card Payment Brick Container */}
            {!paymentStatus && !brickError && (
              <div className="relative min-h-[400px]">
                {processing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
                {!sdkReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Carregando formulário de pagamento...</p>
                  </div>
                )}
                <div 
                  id="cardPaymentBrick_container" 
                  style={{ minHeight: "350px" }}
                  className={sdkReady ? "" : "opacity-0 absolute"}
                />
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
                        {brickError}
                      </p>
                      <p className="text-yellow-700 text-sm mt-1">
                        Você pode tentar novamente ou pagar pelo site do Mercado Pago.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={handleRetry}>
                    Tentar novamente
                  </Button>
                  
                  <Button
                    variant="secondary"
                    onClick={handleFallback}
                    disabled={loadingFallback}
                    className="gap-2"
                  >
                    {loadingFallback ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Pagar no Mercado Pago (alternativo)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);
