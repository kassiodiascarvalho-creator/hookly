import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { ContractFundingModal } from "@/components/payments/ContractFundingModal";

interface ContractApprovalCardProps {
  projectId: string;
  projectTitle: string;
  currency: string;
  agreedAmountCents: number;
  hasVerifiedPayment: boolean;
  contractId: string;
  freelancerUserId: string;
  onFundingComplete: () => void;
}

interface FundingStatus {
  funded: number; // major units
  released: number; // major units
  prefundAmount: number; // major units
  protected: number; // major units (funded - released)
  missing: number; // major units
  contractTotal: number; // major units
}

export function ContractApprovalCard({
  projectId,
  projectTitle,
  currency,
  agreedAmountCents,
  hasVerifiedPayment,
  contractId,
  freelancerUserId,
  onFundingComplete,
}: ContractApprovalCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [fundingStatus, setFundingStatus] = useState<FundingStatus | null>(null);
  const [showFundingModal, setShowFundingModal] = useState(false);

  const contractTotal = agreedAmountCents / 100;

  useEffect(() => {
    fetchFundingStatus();
  }, [contractId, projectId, agreedAmountCents]);

  const fetchFundingStatus = async () => {
    setLoading(true);
    try {
      // 1. Get prefund amount for this project from unified_payments
      const { data: prefundPayments } = await supabase
        .from("unified_payments")
        .select("amount_cents, metadata")
        .eq("payment_type", "project_prefund")
        .eq("status", "paid");

      let prefundAmount = 0;
      prefundPayments?.forEach((p) => {
        const pProjectId = (p.metadata as any)?.project_id;
        if (pProjectId === projectId) {
          // Use base_amount_cents if available (before fee), otherwise amount_cents
          const baseAmount = (p.metadata as any)?.base_amount_cents || p.amount_cents;
          prefundAmount += Number(baseAmount) / 100;
        }
      });

      // 2. Get contract funding from ledger_transactions
      const { data: fundingTx } = await supabase
        .from("ledger_transactions")
        .select("amount")
        .eq("related_contract_id", contractId)
        .eq("tx_type", "contract_funding");

      let contractFunded = 0;
      fundingTx?.forEach((tx) => {
        contractFunded += Math.abs(Number(tx.amount));
      });

      // 3. Get released amounts from ledger_transactions
      const { data: releasedTx } = await supabase
        .from("ledger_transactions")
        .select("amount")
        .eq("related_contract_id", contractId)
        .eq("tx_type", "escrow_release");

      let released = 0;
      releasedTx?.forEach((tx) => {
        released += Math.abs(Number(tx.amount));
      });

      // Calculate totals
      // Total funded = prefund (that can be applied) + contract funding
      // For simplicity, if project had prefund and contract exists, prefund is applicable
      const totalFunded = prefundAmount + contractFunded;
      const protectedAmount = Math.max(0, totalFunded - released);
      const missing = Math.max(0, contractTotal - protectedAmount);

      setFundingStatus({
        funded: totalFunded,
        released,
        prefundAmount,
        protected: protectedAmount,
        missing,
        contractTotal,
      });
    } catch (err) {
      console.error("[ContractApprovalCard] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFundingComplete = () => {
    setShowFundingModal(false);
    fetchFundingStatus();
    onFundingComplete();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!fundingStatus) return null;

  const { protected: protectedAmount, missing, prefundAmount } = fundingStatus;
  const isFullyProtected = missing <= 0;
  const hasPrefund = prefundAmount > 0;
  const needsDifference = hasPrefund && missing > 0;

  return (
    <>
      <Card className={isFullyProtected ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${isFullyProtected ? "text-green-600" : "text-amber-600"}`} />
              <CardTitle className="text-lg">
                {t("contractApproval.title", "Aprovação e Garantia")}
              </CardTitle>
            </div>
            {isFullyProtected ? (
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                {t("contractApproval.fullyProtected", "100% Protegido")}
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t("contractApproval.partiallyProtected", "Proteção Parcial")}
              </Badge>
            )}
          </div>
          <CardDescription>
            {isFullyProtected
              ? t("contractApproval.fullyProtectedDesc", "O valor acordado está totalmente protegido.")
              : t("contractApproval.needsFundingDesc", "Adicione fundos para proteger o valor acordado com o freelancer.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Value Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                {t("contractApproval.agreedAmount", "Valor Acordado")}
              </div>
              <p className="text-xl font-semibold">
                {formatMoney(contractTotal, currency)}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <ShieldCheck className="h-4 w-4" />
                {t("contractApproval.currentlyProtected", "Protegido Atualmente")}
              </div>
              <p className={`text-xl font-semibold ${isFullyProtected ? "text-green-600" : "text-amber-600"}`}>
                {formatMoney(protectedAmount, currency)}
              </p>
            </div>
          </div>

          {/* Missing Amount Warning */}
          {!isFullyProtected && (
            <div className="p-4 bg-amber-100 rounded-lg border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  {needsDifference ? (
                    <>
                      <p className="font-medium text-amber-800">
                        {t("contractApproval.needsDifference", "Adicione a diferença do valor acordado")}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {t(
                          "contractApproval.needsDifferenceDesc",
                          "O valor acordado com o freelancer ({{agreed}}) é maior que o valor inicialmente protegido ({{prefund}}). Adicione {{missing}} para proteger 100% do contrato.",
                          {
                            agreed: formatMoney(contractTotal, currency),
                            prefund: formatMoney(prefundAmount, currency),
                            missing: formatMoney(missing, currency),
                          }
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-amber-800">
                        {t("contractApproval.needsFunding", "Faltam fundos para proteger")}
                      </p>
                      <p className="text-sm text-amber-700 mt-1">
                        {t(
                          "contractApproval.needsFundingValue",
                          "Adicione {{missing}} para proteger 100% do valor acordado.",
                          { missing: formatMoney(missing, currency) }
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={() => setShowFundingModal(true)} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("contractApproval.addFunds", "Adicionar")} {formatMoney(missing, currency)}
                </Button>
              </div>
            </div>
          )}

          {/* Fully Protected Message */}
          {isFullyProtected && (
            <div className="p-4 bg-green-100 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    {t("contractApproval.allGood", "Tudo certo!")}
                  </p>
                  <p className="text-sm text-green-700">
                    {t(
                      "contractApproval.allGoodDesc",
                      "O freelancer pode trabalhar com segurança. Os pagamentos serão liberados conforme as entregas forem aprovadas."
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract Funding Modal */}
      <ContractFundingModal
        open={showFundingModal}
        onOpenChange={setShowFundingModal}
        contractId={contractId}
        amount={missing}
        currency={currency}
        description={projectTitle}
        freelancerUserId={freelancerUserId}
        onPaymentComplete={handleFundingComplete}
      />
    </>
  );
}

export default ContractApprovalCard;
