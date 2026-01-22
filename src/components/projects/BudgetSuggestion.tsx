import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/formatMoney";
import { cn } from "@/lib/utils";

interface BudgetSuggestionProps {
  title: string;
  description: string;
  category: string;
  currency: string;
  currentMin?: string;
  currentMax?: string;
  onApplySuggestion?: (min: number, max: number) => void;
}

interface BudgetResult {
  min_budget: number;
  avg_budget: number;
  max_budget: number;
  reasoning: string;
  complexity: "low" | "medium" | "high";
}

export function BudgetSuggestion({
  title,
  description,
  category,
  currency,
  currentMin,
  currentMax,
  onApplySuggestion,
}: BudgetSuggestionProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAnalyze = title.length >= 5 && description.length >= 20 && category;

  const analyze = async () => {
    if (!canAnalyze) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-project-ai', {
        body: {
          type: 'budget',
          title,
          description,
          category,
          currency,
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data);
    } catch (err) {
      console.error("Budget suggestion error:", err);
      setError(t("projects.ai.budgetError"));
      toast.error(t("projects.ai.budgetError"));
    } finally {
      setLoading(false);
    }
  };

  const getBudgetFeedback = () => {
    if (!result || (!currentMin && !currentMax)) return null;
    
    const min = currentMin ? parseFloat(currentMin) : 0;
    const max = currentMax ? parseFloat(currentMax) : 0;
    const avgCurrent = (min + max) / 2 || min || max;
    
    if (avgCurrent < result.min_budget * 0.8) {
      return {
        type: "warning" as const,
        message: t("projects.ai.budgetTooLow"),
        icon: AlertCircle,
      };
    }
    
    if (avgCurrent >= result.min_budget && avgCurrent <= result.max_budget) {
      return {
        type: "success" as const,
        message: t("projects.ai.budgetAligned"),
        icon: CheckCircle,
      };
    }
    
    if (avgCurrent > result.max_budget) {
      return {
        type: "info" as const,
        message: t("projects.ai.budgetHigh"),
        icon: TrendingUp,
      };
    }
    
    return null;
  };

  const feedback = getBudgetFeedback();

  const feedbackStyles = {
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  };
  const symbol = getCurrencySymbol(currency);

  const complexityColors = {
    low: "bg-green-500/10 text-green-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    high: "bg-red-500/10 text-red-600",
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h4 className="font-medium">{t("projects.ai.budgetTitle")}</h4>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            {!result && (
              <Button
                size="sm"
                variant="outline"
                onClick={analyze}
                disabled={!canAnalyze || loading}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("projects.ai.analyze")}
              </Button>
            )}
          </div>
        </div>

        {!result && !loading && (
          <p className="text-sm text-muted-foreground">
            {canAnalyze 
              ? t("projects.ai.budgetDescription")
              : t("projects.ai.budgetRequirements")
            }
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">{t("projects.ai.analyzing")}</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {result && expanded && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{t("projects.ai.minimum")}</p>
                <p className="font-semibold text-lg">{symbol}{result.min_budget.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">{t("projects.ai.average")}</p>
                <p className="font-semibold text-lg text-primary">{symbol}{result.avg_budget.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{t("projects.ai.maximum")}</p>
                <p className="font-semibold text-lg">{symbol}{result.max_budget.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("projects.ai.complexity")}:</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", complexityColors[result.complexity])}>
                {t(`projects.ai.complexity_${result.complexity}`)}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">{result.reasoning}</p>

            {feedback && (
              <div className={cn(
                "flex items-start gap-2 p-3 rounded-lg text-sm",
                feedbackStyles[feedback.type],
              )}>
                <feedback.icon className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApplySuggestion?.(result.min_budget, result.max_budget)}
                className="flex-1"
              >
                {t("projects.ai.applyRange")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={analyze}
                disabled={loading}
              >
                {t("projects.ai.reanalyze")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
