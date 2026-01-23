import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Loader2, CheckCircle, Clock, CreditCard, AlertTriangle } from "lucide-react";
import { formatMoney, formatMoneyFromCents } from "@/lib/formatMoney";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContractFundingModal } from "./ContractFundingModal";

interface Milestone {
  title: string;
  amount: number;
  description?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: "pending" | "paid" | "released" | "failed";
  stripe_payment_intent_id: string | null;
}

interface ContractInfo {
  was_counterproposal: boolean;
  agreed_amount_cents: number | null;
  original_proposal_amount_cents: number | null;
}

interface MilestonePaymentProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  freelancerUserId: string;
  isCompany: boolean;
  payments: Payment[];
  currency?: string;
  onPaymentComplete: () => void;
}

export default function MilestonePayment({
  projectId,
  projectTitle,
  milestones,
  freelancerUserId,
  isCompany,
  payments,
  currency = "USD",
  onPaymentComplete,
}: MilestonePaymentProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loadingMilestone, setLoadingMilestone] = useState<number | null>(null);
  const [releasingPayment, setReleasingPayment] = useState<string | null>(null);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);
  
  // Funding modal state
  const [fundingModalOpen, setFundingModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<{ index: number; milestone: Milestone } | null>(null);
  const [contractId, setContractId] = useState<string | null>(null);
  const [companyCountry, setCompanyCountry] = useState<string | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);

  // Fetch contract ID, company country, and contract info
  useEffect(() => {
    const fetchContractAndCountry = async () => {
      if (!user || !projectId) return;

      // Get contract for this project with counterproposal info
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, was_counterproposal, agreed_amount_cents, original_proposal_amount_cents")
        .eq("project_id", projectId)
        .maybeSingle();

      if (contract) {
        setContractId(contract.id);
        setContractInfo({
          was_counterproposal: contract.was_counterproposal || false,
          agreed_amount_cents: contract.agreed_amount_cents,
          original_proposal_amount_cents: contract.original_proposal_amount_cents,
        });
      }

      // Get company country for payment routing
      const { data: company } = await supabase
        .from("company_profiles")
        .select("country")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company?.country) {
        setCompanyCountry(company.country);
      }
    };

    fetchContractAndCountry();
  }, [user, projectId]);

  // Always use transparent checkout modal (for any currency)
  const handleFundMilestone = (milestoneIndex: number, milestone: Milestone) => {
    if (!contractId) {
      toast.error("Contrato não encontrado");
      return;
    }
    setSelectedMilestone({ index: milestoneIndex, milestone });
    setFundingModalOpen(true);
  };

  const handleFundingComplete = () => {
    setFundingModalOpen(false);
    setSelectedMilestone(null);
    onPaymentComplete();
  };

  const handleReleasePayment = async (paymentId: string) => {
    // Prevent double-click: if already releasing this payment, ignore
    if (releasingPayment === paymentId) {
      console.log('[MilestonePayment] Already releasing this payment, ignoring duplicate call');
      return;
    }
    
    setReleasingPayment(paymentId);
    setConfirmReleaseId(null);

    try {
      const { data, error } = await supabase.functions.invoke("release-payment", {
        body: { paymentId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Handle idempotent response - still show success
      if (data?.alreadyReleased) {
        console.log('[MilestonePayment] Payment was already released (idempotent)');
        toast.success(t("payments.released"));
      } else {
        toast.success(t("payments.released"));
      }
      
      onPaymentComplete();
    } catch (error) {
      console.error("Release error:", error);
      toast.error(t("payments.releaseError"));
    } finally {
      setReleasingPayment(null);
    }
  };

  const getPaymentForMilestone = (milestoneIndex: number) => {
    // Match payments by approximate amount (within $1)
    const milestone = milestones[milestoneIndex];
    return payments.find(p => 
      Math.abs(Number(p.amount) - milestone.amount) < 1
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("payments.inEscrow")}
          </Badge>
        );
      case "released":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            {t("payments.released")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("payments.pending")}
          </Badge>
        );
      default:
        return null;
    }
  };

  // Use agreed_amount_cents from contract if available, otherwise sum milestones
  const originalMilestoneTotal = milestones.reduce((sum, m) => sum + m.amount, 0);
  const totalAmount = contractInfo?.agreed_amount_cents 
    ? contractInfo.agreed_amount_cents / 100 
    : originalMilestoneTotal;
  
  // Redistribute milestone amounts proportionally when counterproposal was accepted
  const adjustedMilestones = milestones.map((milestone) => {
    if (contractInfo?.agreed_amount_cents && originalMilestoneTotal > 0) {
      const proportion = milestone.amount / originalMilestoneTotal;
      return { ...milestone, amount: Math.round(totalAmount * proportion * 100) / 100 };
    }
    return milestone;
  });

  const fundedAmount = payments.filter(p => p.status === "paid" || p.status === "released")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const releasedAmount = payments.filter(p => p.status === "released")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("payments.milestones")}
            </CardTitle>
            {contractInfo?.was_counterproposal && (
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500">
                <AlertTriangle className="h-3 w-3" />
                Contra-proposta Aceita
              </Badge>
            )}
          </div>
          <CardDescription>
            {isCompany 
              ? t("payments.milestonesDescCompany")
              : t("payments.milestonesDescFreelancer")
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Counterproposal Info */}
          {contractInfo?.was_counterproposal && contractInfo.original_proposal_amount_cents && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Valor negociado via contra-proposta
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Orçamento original: <span className="line-through text-muted-foreground">{formatMoneyFromCents(contractInfo.original_proposal_amount_cents, currency)}</span>
                    {" → "}
                    Valor acordado: <span className="font-semibold text-green-500">{formatMoney(totalAmount, currency)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.totalValue")}</p>
              <p className="text-lg font-bold">{formatMoney(totalAmount, currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.inEscrow")}</p>
              <p className="text-lg font-bold text-amber-600">{formatMoney(fundedAmount - releasedAmount, currency)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.released")}</p>
              <p className="text-lg font-bold text-emerald-600">{formatMoney(releasedAmount, currency)}</p>
            </div>
          </div>

          {/* Milestones List */}
          <div className="space-y-3">
            {adjustedMilestones.map((milestone, idx) => {
              const payment = getPaymentForMilestone(idx);
              const isPaid = payment?.status === "paid";
              const isReleased = payment?.status === "released";
              const canFund = isCompany && !payment;
              const canRelease = isCompany && isPaid;

              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("payments.milestone")} {idx + 1}
                      </span>
                      {payment && getStatusBadge(payment.status)}
                    </div>
                    <h4 className="font-semibold">{milestone.title}</h4>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatMoney(milestone.amount, currency)}</p>
                    </div>
                    
                    {canFund && (
                      <Button
                        onClick={() => handleFundMilestone(idx, milestone)}
                        disabled={loadingMilestone === idx}
                        className="gap-2"
                      >
                        {loadingMilestone === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <DollarSign className="h-4 w-4" />
                        )}
                        {t("payments.fund")}
                      </Button>
                    )}
                    
                    {canRelease && (
                      <Button
                        onClick={() => setConfirmReleaseId(payment.id)}
                        disabled={releasingPayment === payment.id}
                        variant="default"
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {releasingPayment === payment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {t("payments.release")}
                      </Button>
                    )}

                    {isReleased && (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Release Confirmation Dialog */}
      <AlertDialog open={!!confirmReleaseId} onOpenChange={() => setConfirmReleaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payments.confirmRelease")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("payments.confirmReleaseDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReleaseId && handleReleasePayment(confirmReleaseId)}
              className="bg-green-600 hover:bg-green-700"
            >
              {t("payments.confirmReleaseBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contract Funding Modal (Transparent Checkout for BR) */}
      {selectedMilestone && contractId && (
        <ContractFundingModal
          open={fundingModalOpen}
          onOpenChange={setFundingModalOpen}
          contractId={contractId}
          amount={selectedMilestone.milestone.amount}
          currency={currency}
          description={`${projectTitle} - ${selectedMilestone.milestone.title}`}
          freelancerUserId={freelancerUserId}
          onPaymentComplete={handleFundingComplete}
        />
      )}
    </>
  );
}
