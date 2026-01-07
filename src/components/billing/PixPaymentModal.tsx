import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, Loader2, Clock, QrCode, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
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

interface PixPaymentData {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  ticketUrl?: string;
}

interface PixPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pixData: PixPaymentData | null;
  amount: number;
  paymentId: string;
  onPaymentConfirmed?: () => void;
  onRegeneratePayment?: () => void;
}

type PaymentStatus = "pending" | "checking" | "paid" | "failed" | "expired";

export function PixPaymentModal({
  open,
  onOpenChange,
  pixData,
  amount,
  paymentId,
  onPaymentConfirmed,
  onRegeneratePayment,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [statusMessage, setStatusMessage] = useState("");
  
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);
  const maxPolls = 36; // 3 minutes with 5s interval

  // Calculate time remaining
  useEffect(() => {
    if (!pixData?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(pixData.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
        setStatus("expired");
        setTimeLeft("Expirado");
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pixData?.expiresAt]);

  // Check payment status via edge function
  const checkPaymentStatus = useCallback(async (showFeedback = false) => {
    if (!paymentId || status === "paid") return;

    if (showFeedback) {
      setChecking(true);
      setStatus("checking");
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { paymentId },
      });

      if (error) {
        console.error("Error checking payment status:", error);
        if (showFeedback) {
          toast.error("Erro ao verificar status");
          setStatus("pending");
        }
        return;
      }

      if (data?.status === "paid") {
        setStatus("paid");
        setStatusMessage("Pagamento confirmado!");
        toast.success("Pagamento confirmado!");
        
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        
        // Delay before closing to show success message
        setTimeout(() => {
          onPaymentConfirmed?.();
          onOpenChange(false);
        }, 1500);
      } else if (data?.status === "failed" || data?.expired) {
        setStatus("failed");
        setStatusMessage(data?.message || "Pagamento não confirmado");
        if (showFeedback) {
          toast.error(data?.message || "Pagamento não confirmado");
        }
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (data?.status === "pending") {
        setStatus("pending");
        if (showFeedback) {
          setStatusMessage(data?.message || "Aguardando pagamento...");
          toast.info(data?.message || "Pagamento ainda não confirmado. Aguarde e tente novamente.");
        }
      }
    } catch (err) {
      console.error("Error checking payment status:", err);
      if (showFeedback) {
        toast.error("Erro ao verificar status");
        setStatus("pending");
      }
    } finally {
      setChecking(false);
    }
  }, [paymentId, status, onPaymentConfirmed, onOpenChange]);

  // Auto-polling for payment status
  useEffect(() => {
    if (!open || !paymentId || isExpired || status === "paid" || status === "failed") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Start polling
    pollCountRef.current = 0;
    pollingRef.current = setInterval(() => {
      pollCountRef.current++;
      
      if (pollCountRef.current >= maxPolls) {
        // Stop polling after 3 minutes
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }
      
      checkPaymentStatus(false);
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [open, paymentId, isExpired, status, checkPaymentStatus]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStatus("pending");
      setStatusMessage("");
      setChecking(false);
      pollCountRef.current = 0;
    }
  }, [open, paymentId]);

  const handleCopyCode = async () => {
    if (!pixData?.qrCode) return;
    
    try {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código");
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && status !== "paid") {
      // User is closing without confirmed payment
      toast.info("Pagamento não concluído. Você pode retomar a qualquer momento.", {
        duration: 4000,
      });
      console.log("[PIX] checkout_closed", { paymentId, status });
    }
    onOpenChange(isOpen);
  };

  const handleRegenerate = () => {
    onOpenChange(false);
    onRegeneratePayment?.();
  };

  if (!pixData) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código para pagar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3 max-h-[70vh] overflow-y-auto">
          {/* Amount */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Valor a pagar</p>
            <p className="text-2xl font-bold text-primary">
              {formatMoney(amount, "BRL")}
            </p>
          </div>

          {/* Status Messages */}
          {status === "paid" && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">Pagamento confirmado!</p>
            </div>
          )}

          {status === "failed" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800 font-medium">Pagamento não confirmado</p>
              </div>
              <p className="text-red-700 text-xs mt-1">{statusMessage || "Gere um novo PIX para tentar novamente."}</p>
            </div>
          )}

          {/* Timer - only show if pending */}
          {status !== "paid" && status !== "failed" && (
            <div className="flex items-center justify-center gap-2 text-xs">
              <Clock className="h-3 w-3" />
              {isExpired || status === "expired" ? (
                <span className="text-destructive font-medium">
                  QR Code expirado
                </span>
              ) : (
                <span>
                  Expira em <span className="font-mono font-medium">{timeLeft}</span>
                </span>
              )}
            </div>
          )}

          {/* QR Code - only show if pending and not expired */}
          {status !== "paid" && status !== "failed" && !isExpired && (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white rounded-lg border">
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="w-52 h-52 max-w-[220px] max-h-[220px]"
                />
              </div>

              {/* Copy Code */}
              <div className="w-full space-y-2">
                <p className="text-xs text-center text-muted-foreground">
                  Ou copie o código PIX
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-muted rounded-md font-mono text-[10px] break-all max-h-16 overflow-y-auto leading-tight">
                    {pixData.qrCode}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    className="shrink-0 h-8 w-8"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions - only show if pending */}
          {status !== "paid" && status !== "failed" && !isExpired && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
              <p className="font-medium">Como pagar:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar via PIX</li>
                <li>Escaneie ou cole o código</li>
                <li>Confirme o pagamento</li>
              </ol>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {/* Check Status Button - show when pending */}
            {status !== "paid" && status !== "failed" && !isExpired && (
              <Button
                onClick={() => checkPaymentStatus(true)}
                disabled={checking}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {checking ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-2" />
                )}
                Já paguei, verificar status
              </Button>
            )}

            {/* Regenerate Button - show when expired or failed */}
            {(isExpired || status === "expired" || status === "failed") && onRegeneratePayment && (
              <Button
                onClick={handleRegenerate}
                className="w-full"
                size="sm"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Gerar novo PIX
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
