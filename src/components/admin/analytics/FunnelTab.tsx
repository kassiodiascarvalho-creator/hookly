import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FunnelTabProps {
  timeRange: string;
  startDate: Date;
  endDate: Date;
}

interface FunnelStep {
  name: string;
  eventName: string;
  count: number;
  percentage: number;
  dropoff: number;
}

export function FunnelTab({ timeRange, startDate, endDate }: FunnelTabProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    fetchFunnelData();
  }, [startDate, endDate]);

  const fetchFunnelData = async () => {
    setLoading(true);
    try {
      // Get total sessions from page views
      const { data: sessions, error: sessionsError } = await (supabase
        .from("analytics_page_views" as any) as any)
        .select("session_id")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (sessionsError) throw sessionsError;

      const uniqueSessions = new Set((sessions || []).map((s: any) => s.session_id));
      const total = uniqueSessions.size;
      setTotalSessions(total);

      // Get scroll depth events
      const { data: scrollEvents, error: scrollError } = await (supabase
        .from("analytics_events" as any) as any)
        .select("session_id, event_data")
        .eq("event_name", "scroll_depth")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (scrollError) throw scrollError;

      // Get CTA click events
      const { data: ctaEvents, error: ctaError } = await (supabase
        .from("analytics_events" as any) as any)
        .select("session_id")
        .eq("event_name", "cta_click")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (ctaError) throw ctaError;

      // Get signup modal events
      const { data: signupEvents, error: signupError } = await (supabase
        .from("analytics_events" as any) as any)
        .select("session_id")
        .eq("event_name", "signup_modal_open")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (signupError) throw signupError;

      // Get signup type select events
      const { data: typeSelectEvents, error: typeError } = await (supabase
        .from("analytics_events" as any) as any)
        .select("session_id")
        .eq("event_name", "signup_type_select")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (typeError) throw typeError;

      // Calculate unique sessions per step
      const scrolled50Sessions = new Set(
        (scrollEvents || [])
          .filter((e: any) => e.event_data?.depth >= 50)
          .map((e: any) => e.session_id)
      );

      const ctaSessions = new Set((ctaEvents || []).map((e: any) => e.session_id));
      const signupSessions = new Set((signupEvents || []).map((e: any) => e.session_id));
      const typeSelectSessions = new Set((typeSelectEvents || []).map((e: any) => e.session_id));

      // Build funnel
      const steps: FunnelStep[] = [
        {
          name: t("admin.analytics.funnelLanding", "Visita à Landing"),
          eventName: "page_view",
          count: total,
          percentage: 100,
          dropoff: 0,
        },
        {
          name: t("admin.analytics.funnelScroll50", "Scroll > 50%"),
          eventName: "scroll_depth",
          count: scrolled50Sessions.size,
          percentage: total > 0 ? Math.round((scrolled50Sessions.size / total) * 100) : 0,
          dropoff: total > 0 ? Math.round(((total - scrolled50Sessions.size) / total) * 100) : 0,
        },
        {
          name: t("admin.analytics.funnelCTA", "Clique em CTA"),
          eventName: "cta_click",
          count: ctaSessions.size,
          percentage: total > 0 ? Math.round((ctaSessions.size / total) * 100) : 0,
          dropoff: scrolled50Sessions.size > 0 
            ? Math.round(((scrolled50Sessions.size - ctaSessions.size) / scrolled50Sessions.size) * 100) 
            : 0,
        },
        {
          name: t("admin.analytics.funnelSignup", "Abre Modal Signup"),
          eventName: "signup_modal_open",
          count: signupSessions.size,
          percentage: total > 0 ? Math.round((signupSessions.size / total) * 100) : 0,
          dropoff: ctaSessions.size > 0 
            ? Math.round(((ctaSessions.size - signupSessions.size) / ctaSessions.size) * 100) 
            : 0,
        },
        {
          name: t("admin.analytics.funnelTypeSelect", "Escolhe Tipo (Empresa/Freelancer)"),
          eventName: "signup_type_select",
          count: typeSelectSessions.size,
          percentage: total > 0 ? Math.round((typeSelectSessions.size / total) * 100) : 0,
          dropoff: signupSessions.size > 0 
            ? Math.round(((signupSessions.size - typeSelectSessions.size) / signupSessions.size) * 100) 
            : 0,
        },
      ];

      setFunnelSteps(steps);
    } catch (error) {
      console.error("Error fetching funnel data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBarWidth = (percentage: number) => {
    return Math.max(percentage, 5); // Minimum 5% width for visibility
  };

  const getBarColor = (index: number, total: number) => {
    const colors = [
      "bg-primary",
      "bg-blue-500",
      "bg-cyan-500",
      "bg-green-500",
      "bg-emerald-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.totalVisitors", "Total de Visitantes")}</p>
            <p className="text-2xl font-bold">{totalSessions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.reachedCTA", "Chegaram ao CTA")}</p>
            <p className="text-2xl font-bold">
              {funnelSteps[2]?.count || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({funnelSteps[2]?.percentage || 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.startedSignup", "Iniciaram Cadastro")}</p>
            <p className="text-2xl font-bold">
              {funnelSteps[3]?.count || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({funnelSteps[3]?.percentage || 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.overallConversion", "Conversão Total")}</p>
            <p className="text-2xl font-bold text-green-500">
              {funnelSteps[4]?.percentage || 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.analytics.conversionFunnel", "Funil de Conversão")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {funnelSteps.map((step, index) => (
                <div key={step.eventName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                        {index + 1}
                      </div>
                      <span className="font-medium">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary" className="font-mono">
                        {step.count} usuários
                      </Badge>
                      <Badge 
                        variant={step.percentage >= 50 ? "default" : step.percentage >= 20 ? "secondary" : "destructive"}
                        className="font-mono w-16 justify-center"
                      >
                        {step.percentage}%
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative h-10 bg-muted rounded-lg overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full ${getBarColor(index, funnelSteps.length)} transition-all duration-500`}
                      style={{ width: `${getBarWidth(step.percentage)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-medium text-foreground mix-blend-difference">
                        {step.count} ({step.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Dropoff indicator */}
                  {index > 0 && step.dropoff > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground ml-11">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      <span>
                        <span className="text-red-500 font-medium">-{step.dropoff}%</span> abandonaram nesta etapa
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.analytics.insights", "Insights")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {funnelSteps[1]?.dropoff > 30 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <TrendingDown className="h-5 w-5 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-600">Alto abandono no scroll</p>
                    <p className="text-sm text-muted-foreground">
                      {funnelSteps[1].dropoff}% dos usuários não passam da metade da página. Considere mover CTAs para cima.
                    </p>
                  </div>
                </div>
              )}

              {funnelSteps[2]?.dropoff > 50 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <TrendingDown className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-600">Baixa taxa de clique em CTA</p>
                    <p className="text-sm text-muted-foreground">
                      Apenas {funnelSteps[2].percentage}% clicam nos CTAs. Teste textos mais persuasivos ou posicionamento diferente.
                    </p>
                  </div>
                </div>
              )}

              {funnelSteps[4]?.percentage >= 5 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-600">Boa taxa de conversão</p>
                    <p className="text-sm text-muted-foreground">
                      {funnelSteps[4].percentage}% dos visitantes avançam para escolher tipo de conta. Acima da média de 3-5%.
                    </p>
                  </div>
                </div>
              )}

              {funnelSteps[3]?.count > 0 && funnelSteps[4]?.count === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <TrendingDown className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-600">Abandono no modal de signup</p>
                    <p className="text-sm text-muted-foreground">
                      Usuários abrem o modal mas não escolhem tipo. Verifique se o modal é confuso ou tem muitas opções.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
