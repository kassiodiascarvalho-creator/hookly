import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MousePointerClick, 
  FormInput, 
  Navigation,
  HelpCircle,
  ArrowDown,
  Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsEvent {
  id: string;
  session_id: string;
  event_name: string;
  event_data: Record<string, any>;
  page_path: string;
  element_id: string | null;
  element_text: string | null;
  created_at: string;
}

interface EventsTabProps {
  timeRange: string;
  startDate: Date;
  endDate: Date;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  cta_click: MousePointerClick,
  signup_modal_open: FormInput,
  nav_link_click: Navigation,
  faq_expand: HelpCircle,
  scroll_depth: ArrowDown,
  section_view: Layers,
};

const EVENT_COLORS: Record<string, string> = {
  cta_click: "bg-green-500/10 text-green-500 border-green-500/20",
  signup_modal_open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  nav_link_click: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  faq_expand: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  scroll_depth: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  section_view: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

export function EventsTab({ timeRange, startDate, endDate }: EventsTabProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchEvents();
  }, [startDate, endDate]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from("analytics_events" as any) as any)
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setEvents(data || []);

      // Count events by type
      const counts: Record<string, number> = {};
      (data || []).forEach((event: AnalyticsEvent) => {
        counts[event.event_name] = (counts[event.event_name] || 0) + 1;
      });
      setEventCounts(counts);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
    });
  };

  const getEventIcon = (eventName: string) => {
    const Icon = EVENT_ICONS[eventName] || MousePointerClick;
    return <Icon className="h-4 w-4" />;
  };

  const getEventColor = (eventName: string) => {
    return EVENT_COLORS[eventName] || "bg-muted text-muted-foreground";
  };

  const formatEventData = (data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) return null;
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  return (
    <div className="space-y-6">
      {/* Event Counters */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(eventCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([eventName, count]) => (
            <Card key={eventName}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${getEventColor(eventName)}`}>
                    {getEventIcon(eventName)}
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {eventName.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Event Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.analytics.recentEvents", "Eventos Recentes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.analytics.noEvents", "Nenhum evento registrado neste período")}
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${getEventColor(event.event_name)}`}>
                      {getEventIcon(event.event_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {event.event_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(event.created_at)} {formatTime(event.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {event.page_path}
                      </p>
                      {formatEventData(event.event_data) && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {formatEventData(event.event_data)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Top Events by Page */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.analytics.eventsByPage", "Eventos por Página")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  events.reduce((acc, event) => {
                    acc[event.page_path] = (acc[event.page_path] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([page, count]) => (
                    <div key={page} className="flex items-center justify-between">
                      <span className="text-sm truncate text-muted-foreground">{page}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.analytics.ctaPerformance", "Performance dos CTAs")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const ctaCounts = events
                    .filter((e) => e.event_name === "cta_click")
                    .reduce((acc, event) => {
                      const ctaName = event.event_data?.cta_name || "unknown";
                      acc[ctaName] = (acc[ctaName] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>);
                  
                  const entries = Object.entries(ctaCounts).sort((a, b) => b[1] - a[1]);
                  
                  if (entries.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {t("admin.analytics.noCTAClicks", "Nenhum clique em CTA registrado")}
                      </p>
                    );
                  }
                  
                  return entries.map(([cta, count]) => (
                    <div key={cta} className="flex items-center justify-between">
                      <span className="text-sm truncate text-muted-foreground">{cta}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
