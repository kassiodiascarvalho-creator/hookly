import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KPI {
  id: string;
  name: string;
  target: string;
}

interface SuggestedKPI {
  name: string;
  target: string;
  example: string;
}

interface KpiSuggestionProps {
  title: string;
  description: string;
  category: string;
  existingKpis: KPI[];
  onAddKpi: (name: string, target: string) => void;
}

export function KpiSuggestion({
  title,
  description,
  category,
  existingKpis,
  onAddKpi,
}: KpiSuggestionProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedKPI[]>([]);
  const [addedKpis, setAddedKpis] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const canSuggest = title.length >= 5 && description.length >= 20 && category;

  const suggestKpis = async () => {
    if (!canSuggest) return;
    
    setLoading(true);
    setError(null);
    setAddedKpis(new Set());
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-project-ai', {
        body: {
          type: 'kpis',
          title,
          description,
          category,
        }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setSuggestions(data.kpis || []);
    } catch (err) {
      console.error("KPI suggestion error:", err);
      setError(t("projects.ai.kpiError"));
      toast.error(t("projects.ai.kpiError"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddKpi = (kpi: SuggestedKPI) => {
    onAddKpi(kpi.name, kpi.target);
    setAddedKpis(prev => new Set([...prev, kpi.name]));
    toast.success(t("projects.ai.kpiAdded"));
  };

  const handleAddAll = () => {
    suggestions.forEach(kpi => {
      if (!addedKpis.has(kpi.name)) {
        onAddKpi(kpi.name, kpi.target);
      }
    });
    setAddedKpis(new Set(suggestions.map(k => k.name)));
    toast.success(t("projects.ai.allKpisAdded"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{t("projects.ai.kpiTitle")}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={suggestKpis}
          disabled={!canSuggest || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {t("projects.ai.suggestKpis")}
        </Button>
      </div>

      {!suggestions.length && !loading && (
        <p className="text-sm text-muted-foreground">
          {canSuggest 
            ? t("projects.ai.kpiDescription")
            : t("projects.ai.kpiRequirements")
          }
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">{t("projects.ai.generatingKpis")}</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("projects.ai.suggestedKpis", { count: suggestions.length })}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddAll}
              disabled={addedKpis.size === suggestions.length}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              {t("projects.ai.addAll")}
            </Button>
          </div>

          {suggestions.map((kpi, index) => {
            const isAdded = addedKpis.has(kpi.name);
            
            return (
              <Card
                key={index}
                className={cn(
                  "transition-all",
                  isAdded && "border-green-500/50 bg-green-500/5"
                )}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{kpi.name}</p>
                        {isAdded && (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-primary">{kpi.target}</p>
                      <p className="text-xs text-muted-foreground mt-1">{kpi.example}</p>
                    </div>
                    {!isAdded && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddKpi(kpi)}
                        className="shrink-0 h-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
