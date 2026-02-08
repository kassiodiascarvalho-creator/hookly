import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface HeatmapTabProps {
  timeRange: string;
  startDate: Date;
  endDate: Date;
}

interface ClickData {
  x_position: number;
  y_position: number;
  page_path: string;
  viewport_width: number;
  viewport_height: number;
}

interface ScrollData {
  scroll_depth: number;
  page_path: string;
}

export function HeatmapTab({ timeRange, startDate, endDate }: HeatmapTabProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState("/");
  const [pages, setPages] = useState<string[]>([]);
  const [clicks, setClicks] = useState<ClickData[]>([]);
  const [scrollDepths, setScrollDepths] = useState<number[]>([]);
  const [scrollBreakdown, setScrollBreakdown] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchPages();
  }, [startDate, endDate]);

  useEffect(() => {
    if (selectedPage) {
      fetchHeatmapData();
    }
  }, [selectedPage, startDate, endDate]);

  const fetchPages = async () => {
    try {
      const { data, error } = await (supabase
        .from("analytics_interactions" as any) as any)
        .select("page_path")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const uniquePages = [...new Set((data || []).map((d: any) => d.page_path))];
      setPages(uniquePages as string[]);
      if (uniquePages.length > 0 && !uniquePages.includes(selectedPage)) {
        setSelectedPage(uniquePages[0] as string);
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
    }
  };

  const fetchHeatmapData = async () => {
    setLoading(true);
    try {
      // Fetch clicks
      const { data: clickData, error: clickError } = await (supabase
        .from("analytics_interactions" as any) as any)
        .select("x_position, y_position, viewport_width, viewport_height, page_path")
        .eq("interaction_type", "click")
        .eq("page_path", selectedPage)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (clickError) throw clickError;
      setClicks(clickData || []);

      // Fetch scroll depths
      const { data: scrollData, error: scrollError } = await (supabase
        .from("analytics_interactions" as any) as any)
        .select("scroll_depth")
        .eq("interaction_type", "scroll")
        .eq("page_path", selectedPage)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (scrollError) throw scrollError;

      const depths = (scrollData || []).map((d: any) => d.scroll_depth);
      setScrollDepths(depths);

      // Calculate scroll breakdown
      const breakdown: Record<number, number> = { 25: 0, 50: 0, 75: 0, 100: 0 };
      depths.forEach((depth: number) => {
        if (depth >= 100) breakdown[100]++;
        if (depth >= 75) breakdown[75]++;
        if (depth >= 50) breakdown[50]++;
        if (depth >= 25) breakdown[25]++;
      });
      setScrollBreakdown(breakdown);
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate clicks into grid zones
  const getClickZones = () => {
    const zones: Record<string, number> = {};
    const gridSize = 10; // 10x10 grid

    clicks.forEach((click) => {
      if (!click.viewport_width || !click.viewport_height) return;
      
      const xZone = Math.floor((click.x_position / click.viewport_width) * gridSize);
      const yZone = Math.floor((click.y_position / click.viewport_height) * gridSize);
      const key = `${Math.min(xZone, gridSize - 1)}-${Math.min(yZone, gridSize - 1)}`;
      zones[key] = (zones[key] || 0) + 1;
    });

    return zones;
  };

  const clickZones = getClickZones();
  const maxClicks = Math.max(...Object.values(clickZones), 1);
  const totalScrolls = scrollDepths.length || 1;

  const getHeatColor = (intensity: number) => {
    if (intensity > 0.8) return "bg-red-500";
    if (intensity > 0.6) return "bg-orange-500";
    if (intensity > 0.4) return "bg-yellow-500";
    if (intensity > 0.2) return "bg-green-500";
    if (intensity > 0) return "bg-blue-500";
    return "bg-transparent";
  };

  return (
    <div className="space-y-6">
      {/* Page Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">{t("admin.analytics.selectPage", "Selecione a página")}:</label>
        <Select value={selectedPage} onValueChange={setSelectedPage}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione uma página" />
          </SelectTrigger>
          <SelectContent>
            {pages.map((page) => (
              <SelectItem key={page} value={page}>
                {page}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Click Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              {t("admin.analytics.clickHeatmap", "Mapa de Cliques")}
              <Badge variant="secondary">{clicks.length} cliques</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : clicks.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t("admin.analytics.noClickData", "Nenhum dado de cliques para esta página")}
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-10 gap-0.5 aspect-[16/9] bg-muted rounded-lg overflow-hidden">
                  {[...Array(100)].map((_, i) => {
                    const x = i % 10;
                    const y = Math.floor(i / 10);
                    const key = `${x}-${y}`;
                    const count = clickZones[key] || 0;
                    const intensity = count / maxClicks;

                    return (
                      <div
                        key={i}
                        className={`${getHeatColor(intensity)} opacity-70 transition-all hover:opacity-100`}
                        title={`${count} cliques`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded" />
                    <span>Baixo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded" />
                    <span>Médio</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-yellow-500 rounded" />
                    <span>Alto</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded" />
                    <span>Muito Alto</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scroll Depth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              {t("admin.analytics.scrollDepth", "Profundidade de Scroll")}
              <Badge variant="secondary">{scrollDepths.length} sessões</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : scrollDepths.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                {t("admin.analytics.noScrollData", "Nenhum dado de scroll para esta página")}
              </div>
            ) : (
              <div className="space-y-6">
                {[25, 50, 75, 100].map((depth) => {
                  const count = scrollBreakdown[depth] || 0;
                  const percentage = Math.round((count / totalScrolls) * 100);

                  return (
                    <div key={depth} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{depth}% da página</span>
                        <span className="text-muted-foreground">
                          {count} usuários ({percentage}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-3" />
                    </div>
                  );
                })}

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    <strong>{100 - Math.round((scrollBreakdown[50] || 0) / totalScrolls * 100)}%</strong> dos usuários não passam da metade da página.
                    {scrollBreakdown[100] && totalScrolls > 0 && (
                      <span className="block mt-1">
                        Apenas <strong>{Math.round((scrollBreakdown[100] / totalScrolls) * 100)}%</strong> chegam ao final.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Click Hotspots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.analytics.topClickAreas", "Áreas Mais Clicadas")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.entries(clickZones)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(([zone, count], index) => {
                  const [x, y] = zone.split("-").map(Number);
                  const position = getZoneLabel(x, y);

                  return (
                    <div
                      key={zone}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{position}</p>
                        <p className="text-xs text-muted-foreground">{count} cliques</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getZoneLabel(x: number, y: number): string {
  const horizontal = x < 3 ? "Esquerda" : x > 6 ? "Direita" : "Centro";
  const vertical = y < 3 ? "Topo" : y > 6 ? "Rodapé" : "Meio";
  return `${vertical} ${horizontal}`;
}
