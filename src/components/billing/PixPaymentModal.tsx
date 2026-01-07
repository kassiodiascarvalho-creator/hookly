import { useState, useEffect } from "react";
import { Copy, Check, Loader2, Clock, QrCode } from "lucide-react";
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
}

export function PixPaymentModal({
  open,
  onOpenChange,
  pixData,
  amount,
  paymentId,
  onPaymentConfirmed,
}: PixPaymentModalProps) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [checking, setChecking] = useState(false);

  // Calculate time remaining
  useEffect(() => {
    if (!pixData?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(pixData.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setIsExpired(true);
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

  // Poll for payment status
  useEffect(() => {
    if (!open || !paymentId || isExpired) return;

    const pollStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("unified_payments")
          .select("status")
          .eq("id", paymentId)
          .single();

        if (data?.status === "paid") {
          toast.success("Pagamento confirmado!");
          onPaymentConfirmed?.();
          onOpenChange(false);
        }
      } catch (err) {
        console.error("Error polling payment status:", err);
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [open, paymentId, isExpired, onPaymentConfirmed, onOpenChange]);

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

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from("unified_payments")
        .select("status")
        .eq("id", paymentId)
        .single();

      if (data?.status === "paid") {
        toast.success("Pagamento confirmado!");
        onPaymentConfirmed?.();
        onOpenChange(false);
      } else {
        toast.info("Aguardando pagamento...");
      }
    } catch {
      toast.error("Erro ao verificar status");
    } finally {
      setChecking(false);
    }
  };

  if (!pixData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 text-xs">
            <Clock className="h-3 w-3" />
            {isExpired ? (
              <span className="text-destructive font-medium">
                QR Code expirado
              </span>
            ) : (
              <span>
                Expira em <span className="font-mono font-medium">{timeLeft}</span>
              </span>
            )}
          </div>

          {/* QR Code */}
          {!isExpired && (
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

          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
            <p className="font-medium">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar via PIX</li>
              <li>Escaneie ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          {/* Check Status Button */}
          <Button
            onClick={handleCheckStatus}
            disabled={checking || isExpired}
            variant="outline"
            className="w-full"
            size="sm"
          >
            {checking ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : null}
            Já paguei, verificar status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
