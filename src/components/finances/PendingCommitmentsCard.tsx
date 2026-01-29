import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, CheckCircle, FileText, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney } from "@/lib/formatMoney";
import { PendingCommitmentsModal } from "./PendingCommitmentsModal";

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface ContractPending {
  id: string;
  title: string;
  contractTotal: number;
  protectedCurrent: number;
  missing: number;
  currency: string;
  freelancerName: string | null;
  freelancerUserId: string;
}

interface PendingCommitmentsCardProps {
  byCurrency: CurrencyAmount[];
  contracts: ContractPending[];
  totalContracts: number;
  loading: boolean;
  onPaymentComplete: () => void;
}

export function PendingCommitmentsCard({
  byCurrency,
  contracts,
  totalContracts,
  loading,
  onPaymentComplete,
}: PendingCommitmentsCardProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  const hasPending = byCurrency.length > 0 && byCurrency.some((c) => c.amount > 0);
  const maxCurrenciesToShow = 3;
  const displayCurrencies = byCurrency.slice(0, maxCurrenciesToShow);
  const extraCount = byCurrency.length - maxCurrenciesToShow;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={hasPending ? "border-amber-500/30" : "border-green-500/30"}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${hasPending ? "bg-amber-500/10" : "bg-green-500/10"}`}>
                <Shield className={`h-5 w-5 ${hasPending ? "text-amber-600" : "text-green-600"}`} />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t("companyFinances.pendingCommitments.title", "Compromissos Pendentes")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("companyFinances.pendingCommitments.description", "Valores acordados que ainda não estão 100% protegidos")}
                </CardDescription>
              </div>
            </div>
            {totalContracts > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {totalContracts}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("companyFinances.pendingCommitments.contractsCount", "{{count}} contratos pendentes", { count: totalContracts })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasPending ? (
            <div className="flex items-center gap-2 text-green-600 py-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                {t("companyFinances.pendingCommitments.allProtected", "Tudo protegido ✅")}
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Currency amounts */}
              <div className="space-y-1">
                {displayCurrencies.map(({ currency, amount }) => (
                  <div key={currency} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{currency}</span>
                    <span className="font-semibold text-amber-600">{formatMoney(amount, currency)}</span>
                  </div>
                ))}
                {extraCount > 0 && (
                  <button
                    onClick={() => setModalOpen(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    +{extraCount} {t("common.more", "mais")}
                  </button>
                )}
              </div>

              {/* CTA Button */}
              <Button
                variant="default"
                size="sm"
                className="w-full gap-2"
                onClick={() => setModalOpen(true)}
              >
                <Shield className="h-4 w-4" />
                {t("companyFinances.pendingCommitments.protectNow", "Proteger agora")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PendingCommitmentsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        contracts={contracts}
        onPaymentComplete={onPaymentComplete}
      />
    </>
  );
}
