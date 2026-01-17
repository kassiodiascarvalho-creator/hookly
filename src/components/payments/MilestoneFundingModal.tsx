import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2, QrCode, CreditCard, Wallet, CheckCircle, AlertCircle, AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/formatMoney";
import { PixPaymentModal } from "@/components/billing/PixPaymentModal";
import { CardPaymentModal, type CardPaymentModalProps } from "@/components/billing/CardPaymentModal";

type PaymentMethod = "credits" | "pix" | "card";

interface MilestoneFundingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  milestoneIndex: number;
  milestoneTitle: string;
  milestoneAmount: number; // Original amount from contract in currency units
  currency: string;
  freelancerUserId: string;
  onPaymentComplete: () => void;
}

interface UserBalance {
  balance_cents: number;
  escrow_held: number;
}

export function MilestoneFundingModal({
  open,
  onOpenChange,
  contractId,
  milestoneIndex,
  milestoneTitle,
  milestoneAmount,
  currency,
  freelancerUserId,
  onPaymentComplete,
}: MilestoneFundingModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Form state
  const [amount, setAmount] = useState<string>(milestoneAmount.toString());
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
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
  const [pixAmountValue, setPixAmountValue] = useState(0);

  // Card payment state
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardAmountCents, setCardAmountCents] = useState(0);

  // Credits payment state
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsSuccess, setCreditsSuccess] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);

  // Derived state
  const parsedAmount = parseFloat(amount) || 0;
  const amountCents = Math.round(parsedAmount * 100);
  const originalAmountCents = Math.round(milestoneAmount * 100);
  const isBRL = currency === "BRL";
  const canUsePix = isBRL;
  const canUseTransparentCard = isBRL && mpPublicKey.length > 0;
  const hasEnoughCredits = userBalance && userBalance.balance_cents >= amountCents;
  
  // Validation
  const isAmountValid = parsedAmount > 0 && parsedAmount <= milestoneAmount;
  const isAmountDifferent = amountCents !== originalAmountCents && parsedAmount > 0;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmount(milestoneAmount.toString());
      setCreditsSuccess(false);
      setCreditsError(null);
      fetchUserData();
    }
  }, [open, milestoneAmount]);

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

    // Fetch company wallet balance (not user_balances.credits_available)
    const { data: wallet } = await supabase
      .from("company_wallets")
      .select("balance_cents")
      .eq("company_user_id", user.id)
      .single();

    // Also fetch escrow from user_balances
    const { data: userBalanceData } = await supabase
      .from("user_balances")
      .select("escrow_held")
      .eq("user_id", user.id)
      .eq("user_type", "company")
      .single();

    if (wallet) {
      setUserBalance({
        balance_cents: wallet.balance_cents || 0,
        escrow_held: userBalanceData?.escrow_held || 0,
      });
    }
  };

  /**
   * CREDITS PAYMENT (Internal ledger movement only)
   * - NO real money involved
   * - NO Mercado Pago call
   * - Debits from credits_available
   * - Credits to escrow_held
   * - Recorded in ledger_transactions as simulation
   */
  const handlePayWithCredits = async () => {
    if (!user || !hasEnoughCredits || !isAmountValid) return;

    setCreditsLoading(true);
    setCreditsError(null);

    try {
      console.log("[MilestoneFundingModal] Funding with CREDITS (internal ledger only)", {
        contractId,
        milestoneIndex,
        amountCents,
        originalAmountCents,
      });

      const { data, error } = await supabase.functions.invoke("fund-contract-with-credits", {
        body: {
          contractId,
          amountCents,
          freelancerUserId,
          description: `Milestone: ${milestoneTitle}`,
          milestoneIndex,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setCreditsSuccess(true);
        toast.success("Milestone financiado com sucesso!");
        setTimeout(() => {
          onOpenChange(false);
          onPaymentComplete();
        }, 1500);
      } else {
        throw new Error(data?.error || "Erro ao financiar milestone");
      }
    } catch (error) {
      console.error("[MilestoneFundingModal] Credits payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
      setCreditsError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreditsLoading(false);
    }
  };

  /**
   * PIX PAYMENT (Real money flow)
   * - Creates real payment via Mercado Pago
   * - Money goes to PLATFORM account
   * - On webhook confirmation: creates internal credits + moves to escrow
   * - Freelancer sees only internal credits, NOT real money
   */
  const handlePayWithPix = async () => {
    if (!isAmountValid) return;
    setLoading(true);

    try {
      console.log("[MilestoneFundingModal] Creating PIX payment (REAL MONEY)", {
        contractId,
        milestoneIndex,
        amountCents,
      });

      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents,
          contractId,
          freelancerUserId,
          description: `Financiar Milestone: ${milestoneTitle}`,
          metadata: {
            milestoneIndex,
            originalAmountCents,
          },
        },
      });

      if (error) throw error;

      if (data?.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixAmountValue(data.amount);
        onOpenChange(false);
        setPixModalOpen(true);
      }
    } catch (error) {
      console.error("[MilestoneFundingModal] PIX error:", error);
      toast.error("Erro ao gerar PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * CARD PAYMENT (Real money flow)
   * - Creates real payment via Mercado Pago
   * - Money goes to PLATFORM account
   * - On confirmation: creates internal credits + moves to escrow
   * - Freelancer sees only internal credits, NOT real money
   */
  const handlePayWithCard = async () => {
    if (!isAmountValid) return;

    console.log("[MilestoneFundingModal] Opening card modal (REAL MONEY)", {
      contractId,
      milestoneIndex,
      amountCents,
    });

    setCardAmountCents(amountCents);
    onOpenChange(false);
    setCardModalOpen(true);
  };

  const handlePaymentConfirmed = () => {
    toast.success("Pagamento confirmado! Milestone financiado.");
    setPixModalOpen(false);
    setCardModalOpen(false);
    setPixData(null);
    onPaymentComplete();
  };

  const handleRegeneratePixPayment = async () => {
    if (!isAmountValid) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: {
          paymentType: "contract_funding",
          userType: "company",
          amountCents,
          contractId,
          freelancerUserId,
          description: `Financiar Milestone: ${milestoneTitle}`,
          metadata: {
            milestoneIndex,
            originalAmountCents,
          },
        },
      });

      if (error) throw error;

      if (data?.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixAmountValue(data.amount);
        setPixModalOpen(true);
      }
    } catch (error) {
      console.error("[MilestoneFundingModal] PIX regenerate error:", error);
      toast.error("Erro ao gerar novo PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!isAmountValid) {
      toast.error("Digite um valor válido");
      return;
    }

    if (paymentMethod === "credits") {
      handlePayWithCredits();
    } else if (paymentMethod === "pix") {
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
              Financiar Milestone
            </DialogTitle>
            <DialogDescription>
              O valor ficará em escrow na plataforma até a aprovação do trabalho.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Milestone Info */}
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground">Milestone</p>
              <p className="font-medium">{milestoneTitle}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Valor do contrato: {formatMoney(milestoneAmount, currency)}
              </p>
            </div>

            {/* Success State */}
            {creditsSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center justify-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-800 font-medium">Milestone financiado com sucesso!</p>
              </div>
            )}

            {/* Error State */}
            {creditsError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <p className="text-red-800 font-medium">Erro no financiamento</p>
                </div>
                <p className="text-red-700 text-sm mt-1">{creditsError}</p>
              </div>
            )}

            {!creditsSuccess && (
              <>
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor a financiar ({currency})</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    max={milestoneAmount}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg font-medium"
                  />
                  
                  {/* Validation warnings */}
                  {parsedAmount <= 0 && amount !== "" && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      O valor deve ser maior que zero
                    </p>
                  )}
                  
                  {parsedAmount > milestoneAmount && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      O valor não pode exceder {formatMoney(milestoneAmount, currency)}
                    </p>
                  )}
                  
                  {isAmountDifferent && isAmountValid && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 p-2 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800">
                        Você está financiando um valor diferente do contrato.
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-3">
                  <Label>Forma de pagamento</Label>
                  <div className="grid gap-3">
                    {/* PIX Option */}
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
                          <p className="font-medium">PIX</p>
                          <p className="text-xs text-muted-foreground">
                            Pagamento instantâneo • Dinheiro real
                          </p>
                        </div>
                        {paymentMethod === "pix" && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    )}

                    {/* Card Option */}
                    {(canUseTransparentCard || !isBRL) && (
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
                          <p className="font-medium">Cartão</p>
                          <p className="text-xs text-muted-foreground">
                            Crédito ou débito • Dinheiro real
                          </p>
                        </div>
                        {paymentMethod === "card" && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    )}

                    {/* Credits Option */}
                    {userBalance && (
                      <button
                        onClick={() => setPaymentMethod("credits")}
                        disabled={!hasEnoughCredits}
                        className={`
                          p-4 rounded-lg border-2 text-left transition-all flex items-center gap-3
                          ${paymentMethod === "credits" && hasEnoughCredits
                            ? "border-primary bg-primary/5"
                            : !hasEnoughCredits
                            ? "border-border opacity-50 cursor-not-allowed"
                            : "border-border hover:border-primary/50"
                          }
                        `}
                      >
                        <Wallet className="h-6 w-6 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium">Saldo da Plataforma</p>
                          <p className="text-xs text-muted-foreground">
                            Disponível: {formatMoney(userBalance.balance_cents / 100, currency)}
                          </p>
                          {!hasEnoughCredits && (
                            <p className="text-xs text-destructive mt-1">
                              Saldo insuficiente
                            </p>
                          )}
                        </div>
                        {hasEnoughCredits && paymentMethod === "credits" && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Escrow explanation */}
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                  <p className="font-medium mb-1">⚡ Escrow de Segurança</p>
                  <p className="text-blue-700">
                    {paymentMethod === "credits" 
                      ? "Seus créditos serão reservados até a aprovação do trabalho. Nenhum pagamento externo será realizado."
                      : "O valor ficará em garantia na plataforma. O freelancer só receberá após sua aprovação."
                    }
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={
                    loading || 
                    creditsLoading || 
                    !isAmountValid ||
                    (paymentMethod === "credits" && !hasEnoughCredits)
                  }
                  className="w-full"
                  size="lg"
                >
                  {loading || creditsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : paymentMethod === "credits" ? (
                    <Wallet className="h-4 w-4 mr-2" />
                  ) : paymentMethod === "pix" ? (
                    <QrCode className="h-4 w-4 mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  {loading || creditsLoading
                    ? "Processando..."
                    : paymentMethod === "credits"
                    ? "Financiar com Saldo"
                    : paymentMethod === "pix"
                    ? "Gerar QR Code PIX"
                    : "Pagar com Cartão"
                  }
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* PIX Payment Modal */}
      <PixPaymentModal
        open={pixModalOpen}
        onOpenChange={setPixModalOpen}
        pixData={pixData}
        amount={pixAmountValue}
        paymentId={pixPaymentId}
        onPaymentConfirmed={handlePaymentConfirmed}
        onRegeneratePayment={handleRegeneratePixPayment}
      />

      {/* Card Payment Modal */}
      <CardPaymentModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        amount={cardAmountCents}
        publicKey={mpPublicKey}
        paymentType="contract_funding"
        userType="company"
        description={`Financiar Milestone: ${milestoneTitle}`}
        currency={currency}
        contractId={contractId}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
}
