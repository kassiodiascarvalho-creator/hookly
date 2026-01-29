import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, CheckCircle, FolderOpen, ChevronRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoney } from "@/lib/formatMoney";
import { UnfundedPotentialModal } from "./UnfundedPotentialModal";

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface ProjectUnfunded {
  id: string;
  title: string;
  budgetMax: number;
  currency: string;
}

interface UnfundedPotentialCardProps {
  byCurrency: CurrencyAmount[];
  projects: ProjectUnfunded[];
  totalProjects: number;
  loading: boolean;
  onPaymentComplete: () => void;
}

export function UnfundedPotentialCard({
  byCurrency,
  projects,
  totalProjects,
  loading,
  onPaymentComplete,
}: UnfundedPotentialCardProps) {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  const hasUnfunded = byCurrency.length > 0 && byCurrency.some((c) => c.amount > 0);
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
      <Card className={hasUnfunded ? "border-blue-500/30" : "border-green-500/30"}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${hasUnfunded ? "bg-blue-500/10" : "bg-green-500/10"}`}>
                <Briefcase className={`h-5 w-5 ${hasUnfunded ? "text-blue-600" : "text-green-600"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {t("companyFinances.unfundedPotential.title", "Potencial sem Fundos")}
                  </CardTitle>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>
                          {t("companyFinances.unfundedPotential.tooltip", "Este valor representa o orçamento máximo anunciado, não uma obrigação de pagamento.")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription className="text-xs">
                  {t("companyFinances.unfundedPotential.description", "Projetos publicados sem proteção de pagamento")}
                </CardDescription>
              </div>
            </div>
            {totalProjects > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      <FolderOpen className="h-3 w-3 mr-1" />
                      {totalProjects}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("companyFinances.unfundedPotential.projectsCount", "{{count}} projetos sem fundos", { count: totalProjects })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasUnfunded ? (
            <div className="flex items-center gap-2 text-green-600 py-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                {t("companyFinances.unfundedPotential.allFunded", "Nenhum projeto sem fundos ✅")}
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Currency amounts */}
              <div className="space-y-1">
                {displayCurrencies.map(({ currency, amount }) => (
                  <div key={currency} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{currency}</span>
                    <span className="font-semibold text-blue-600">{formatMoney(amount, currency)}</span>
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
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setModalOpen(true)}
              >
                <Briefcase className="h-4 w-4" />
                {t("companyFinances.unfundedPotential.addFunds", "Adicionar fundos")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <UnfundedPotentialModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projects={projects}
        onPaymentComplete={onPaymentComplete}
      />
    </>
  );
}
