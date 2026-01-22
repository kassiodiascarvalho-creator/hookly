import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, Clock, Crown, Award, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeniusAccess } from "@/hooks/useGeniusAccess";
import { GeniusPurchaseModal } from "./GeniusPurchaseModal";
import { toast } from "sonner";

interface GeniusRankingButtonProps {
  projectId: string;
  proposalsCount: number;
  onRankingGenerated?: (rankings: RankedProposal[]) => void;
  disabled?: boolean;
}

interface RankedProposal {
  proposalId: string;
  rank: number;
  score: number;
  recommendation: string;
  strengths: string[];
  considerations: string[];
  matchReason: string;
}

interface RankingResult {
  rankings: RankedProposal[];
  summary: string;
  topPick?: {
    proposalId: string;
    reason: string;
  };
  generatedAt: string;
  proposalsAnalyzed: number;
}

export function GeniusRankingButton({
  projectId,
  proposalsCount,
  onRankingGenerated,
  disabled,
}: GeniusRankingButtonProps) {
  const { t, i18n } = useTranslation();
  const { hasAccess, source, daysRemaining, loading: accessLoading, refetch } = useGeniusAccess("ranking_ai");
  
  const [modalOpen, setModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<RankingResult | null>(null);

  const handleAnalyze = async () => {
    if (!hasAccess) {
      setPurchaseModalOpen(true);
      return;
    }

    if (proposalsCount === 0) {
      toast.info(t("genius.noProposalsToAnalyze", "Nenhuma proposta para analisar"));
      return;
    }

    setModalOpen(true);
    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("genius-ranking", {
        body: {
          projectId,
          language: i18n.language || "pt",
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.requiresUpgrade) {
          setPurchaseModalOpen(true);
          setModalOpen(false);
          return;
        }
        throw new Error(data.error);
      }

      setResult(data);
      if (onRankingGenerated && data.rankings) {
        onRankingGenerated(data.rankings);
      }
    } catch (error) {
      console.error("Failed to analyze proposals:", error);
      toast.error(t("genius.analysisError", "Erro ao analisar propostas"));
      setModalOpen(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePurchaseSuccess = () => {
    refetch();
    setPurchaseModalOpen(false);
    handleAnalyze();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-orange-600";
  };

  const getScoreBackground = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <>
      <Button
        variant={hasAccess ? "default" : "outline"}
        onClick={handleAnalyze}
        disabled={disabled || accessLoading || proposalsCount === 0}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {t("genius.analyzeProposals", "Analisar Propostas")}
        {proposalsCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {proposalsCount}
          </Badge>
        )}
        {hasAccess && source === "credits" && daysRemaining && (
          <Badge variant="secondary" className="ml-1 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {daysRemaining}d
          </Badge>
        )}
        {hasAccess && source === "plan" && (
          <Crown className="h-3 w-3 ml-1 text-yellow-500" />
        )}
      </Button>

      {/* Analysis Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) setResult(null);
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Hookly Genius - {t("genius.proposalAnalysis", "Análise de Propostas")}
            </DialogTitle>
            <DialogDescription>
              {analyzing 
                ? t("genius.analyzingProposals", "Analisando propostas com IA...")
                : result 
                ? t("genius.analysisComplete", `${result.proposalsAnalyzed} propostas analisadas`)
                : ""}
            </DialogDescription>
          </DialogHeader>

          {analyzing ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {t("genius.aiAnalyzing", "A IA está analisando as propostas...")}
              </p>
            </div>
          ) : result ? (
            <div className="space-y-6 py-4">
              {/* Summary */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="pt-4">
                  <p className="text-sm">{result.summary}</p>
                </CardContent>
              </Card>

              {/* Top Pick */}
              {result.topPick && (
                <Card className="border-2 border-green-500/50 bg-green-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                      <Award className="h-4 w-4" />
                      {t("genius.topRecommendation", "Recomendação Principal")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{result.topPick.reason}</p>
                  </CardContent>
                </Card>
              )}

              {/* Rankings */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {t("genius.rankingResults", "Ranking de Propostas")}
                </h4>
                
                {result.rankings.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {t("genius.noRankings", "Nenhuma proposta para ranquear")}
                    </CardContent>
                  </Card>
                ) : (
                  result.rankings.map((ranking) => (
                    <Card key={ranking.proposalId} className="hover:border-primary/50 transition-colors">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold">
                              {ranking.rank}º
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={getScoreColor(ranking.score)}
                                >
                                  {ranking.recommendation}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {ranking.matchReason}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-2xl font-bold ${getScoreColor(ranking.score)}`}>
                              {ranking.score}
                            </span>
                            <Progress 
                              value={ranking.score} 
                              className="w-16 h-2 mt-1"
                            />
                          </div>
                        </div>

                        {/* Strengths & Considerations */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-xs font-medium text-green-600 mb-1">
                              {t("genius.strengths", "Pontos Fortes")}
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1">
                              {ranking.strengths.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                          {ranking.considerations.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-amber-600 mb-1">
                                {t("genius.considerations", "Considerações")}
                              </p>
                              <ul className="text-xs text-muted-foreground space-y-1">
                                {ranking.considerations.map((c, i) => (
                                  <li key={i}>• {c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  {t("genius.disclaimer", "Esta análise é uma sugestão baseada em IA. A decisão final de contratação é sua responsabilidade.")}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Purchase Modal */}
      <GeniusPurchaseModal
        open={purchaseModalOpen}
        onOpenChange={setPurchaseModalOpen}
        featureType="ranking_ai"
        onSuccess={handlePurchaseSuccess}
      />
    </>
  );
}
