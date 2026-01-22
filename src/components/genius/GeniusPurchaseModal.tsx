import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, Clock, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformCredits } from "@/hooks/usePlatformCredits";
import { toast } from "sonner";

interface GeniusPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureType: "proposal_ai" | "ranking_ai";
  onSuccess: () => void;
}

interface AccessOption {
  id: "2days" | "5days";
  days: number;
  credits: number;
  popular?: boolean;
}

const accessOptions: AccessOption[] = [
  { id: "2days", days: 2, credits: 5 },
  { id: "5days", days: 5, credits: 10, popular: true },
];

export function GeniusPurchaseModal({
  open,
  onOpenChange,
  featureType,
  onSuccess,
}: GeniusPurchaseModalProps) {
  const { t } = useTranslation();
  const { balance: credits, loading: creditsLoading, refreshBalance } = usePlatformCredits();
  const [selectedOption, setSelectedOption] = useState<"2days" | "5days" | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const featureTitle = featureType === "proposal_ai" 
    ? t("genius.proposalAI", "IA de Propostas")
    : t("genius.rankingAI", "IA de Análise");

  const handlePurchase = async () => {
    if (!selectedOption) return;

    const option = accessOptions.find(o => o.id === selectedOption);
    if (!option) return;

    if (credits < option.credits) {
      toast.error(t("genius.insufficientCredits", "Créditos insuficientes"));
      return;
    }

    setPurchasing(true);
    try {
      const { data, error } = await supabase.functions.invoke("genius-purchase-access", {
        body: {
          featureType,
          accessDuration: selectedOption,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error === "insufficient_credits") {
          toast.error(data.message);
          return;
        }
        throw new Error(data.error);
      }

      toast.success(t("genius.accessActivated", "Acesso ao Hookly Genius ativado!"));
      refreshBalance();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to purchase access:", error);
      toast.error(t("common.error", "Erro ao processar solicitação"));
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Hookly Genius - {featureTitle}
          </DialogTitle>
          <DialogDescription>
            {t("genius.purchaseDescription", "Escolha o período de acesso ao Hookly Genius")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credit Balance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">
              {t("genius.yourCredits", "Seus créditos")}
            </span>
            <Badge variant="secondary" className="text-base">
              {creditsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : credits}
            </Badge>
          </div>

          {/* Access Options */}
          <div className="grid gap-3">
            {accessOptions.map((option) => {
              const canAfford = credits >= option.credits;
              const isSelected = selectedOption === option.id;

              return (
                <Card
                  key={option.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20"
                      : canAfford
                      ? "hover:border-primary/50"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={() => canAfford && setSelectedOption(option.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                          <Clock className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {option.days} {t("genius.days", "dias")}
                            </span>
                            {option.popular && (
                              <Badge className="bg-gradient-to-r from-primary to-primary/80 text-xs">
                                {t("genius.bestValue", "Melhor valor")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("genius.fullAccess", "Acesso completo ao")} {featureTitle}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-lg">{option.credits}</p>
                          <p className="text-xs text-muted-foreground">{t("genius.credits", "créditos")}</p>
                        </div>
                        {isSelected && (
                          <div className="p-1 rounded-full bg-primary">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Features */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-primary" />
              {t("genius.included", "Incluído")}
            </h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {featureType === "proposal_ai" ? (
                <>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.unlimitedProposals", "Geração ilimitada de propostas")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.personalizedContent", "Conteúdo personalizado ao seu perfil")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.multipleTones", "Múltiplos tons de escrita")}
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.smartRanking", "Ranking inteligente de propostas")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.detailedAnalysis", "Análise detalhada de cada candidato")}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-500" />
                    {t("genius.feature.matchReasons", "Explicação dos motivos de match")}
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {t("common.cancel", "Cancelar")}
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={!selectedOption || purchasing}
            className="flex-1 gap-2"
          >
            {purchasing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t("genius.activateAccess", "Ativar Acesso")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
