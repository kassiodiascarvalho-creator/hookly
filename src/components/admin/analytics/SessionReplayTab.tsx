import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  FileStack,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

interface SessionRecording {
  id: string;
  session_id: string;
  recording_events: any[];
  duration_seconds: number;
  page_count: number;
  pages_visited: string[];
  is_bounce: boolean;
  device_type: string;
  country: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface SessionReplayTabProps {
  timeRange: string;
  startDate: Date;
  endDate: Date;
}

export function SessionReplayTab({ timeRange, startDate, endDate }: SessionReplayTabProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<SessionRecording | null>(null);
  const [filterBounce, setFilterBounce] = useState<boolean | null>(null);
  const [filterDevice, setFilterDevice] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    fetchRecordings();
  }, [startDate, endDate, filterBounce, filterDevice]);

  useEffect(() => {
    if (selectedRecording && playerContainerRef.current) {
      initPlayer();
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current = null;
      }
    };
  }, [selectedRecording]);

  const fetchRecordings = async () => {
    setLoading(true);
    try {
      let query = (supabase
        .from("analytics_session_recordings" as any) as any)
        .select("*")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (filterBounce !== null) {
        query = query.eq("is_bounce", filterBounce);
      }

      if (filterDevice) {
        query = query.eq("device_type", filterDevice);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error("Error fetching recordings:", error);
    } finally {
      setLoading(false);
    }
  };

  const initPlayer = () => {
    if (!selectedRecording || !playerContainerRef.current) return;

    // Clear previous player
    if (playerRef.current) {
      playerRef.current.pause();
    }
    playerContainerRef.current.innerHTML = "";

    // Check if we have valid events
    const events = selectedRecording.recording_events;
    if (!events || events.length < 2) {
      playerContainerRef.current.innerHTML = `
        <div class="flex items-center justify-center h-full text-muted-foreground">
          <p>Gravação não possui eventos suficientes para reprodução.</p>
        </div>
      `;
      return;
    }

    try {
      playerRef.current = new rrwebPlayer({
        target: playerContainerRef.current,
        props: {
          events,
          width: 800,
          height: 450,
          autoPlay: false,
          showController: true,
          speedOption: [1, 2, 4, 8],
        },
      });
    } catch (error) {
      console.error("Error initializing player:", error);
      playerContainerRef.current.innerHTML = `
        <div class="flex items-center justify-center h-full text-muted-foreground">
          <p>Erro ao carregar gravação.</p>
        </div>
      `;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const bounceCount = recordings.filter((r) => r.is_bounce).length;
  const avgDuration = recordings.length > 0 
    ? Math.round(recordings.reduce((sum, r) => sum + r.duration_seconds, 0) / recordings.length) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.totalRecordings", "Gravações")}</p>
            <p className="text-2xl font-bold">{recordings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.bounceSessions", "Sessões Bounce")}</p>
            <p className="text-2xl font-bold text-red-500">
              {bounceCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({recordings.length > 0 ? Math.round((bounceCount / recordings.length) * 100) : 0}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.avgDuration", "Duração Média")}</p>
            <p className="text-2xl font-bold">{formatDuration(avgDuration)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("admin.analytics.avgPages", "Páginas/Sessão")}</p>
            <p className="text-2xl font-bold">
              {recordings.length > 0 
                ? (recordings.reduce((sum, r) => sum + r.page_count, 0) / recordings.length).toFixed(1) 
                : 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant={filterBounce === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterBounce(null)}
        >
          Todas
        </Button>
        <Button
          variant={filterBounce === true ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterBounce(true)}
        >
          Apenas Bounce
        </Button>
        <Button
          variant={filterBounce === false ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterBounce(false)}
        >
          Engajadas
        </Button>
        <div className="h-6 w-px bg-border" />
        <Button
          variant={filterDevice === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterDevice(null)}
        >
          Todos Dispositivos
        </Button>
        <Button
          variant={filterDevice === "desktop" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterDevice("desktop")}
        >
          <Monitor className="h-4 w-4 mr-1" />
          Desktop
        </Button>
        <Button
          variant={filterDevice === "mobile" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterDevice("mobile")}
        >
          <Smartphone className="h-4 w-4 mr-1" />
          Mobile
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Recordings List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("admin.analytics.recordings", "Gravações")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : recordings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>{t("admin.analytics.noRecordings", "Nenhuma gravação encontrada")}</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-1 p-2">
                  {recordings.map((recording) => (
                    <button
                      key={recording.id}
                      onClick={() => setSelectedRecording(recording)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedRecording?.id === recording.id
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(recording.device_type)}
                          {recording.is_bounce && (
                            <Badge variant="destructive" className="text-xs">Bounce</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(recording.started_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(recording.duration_seconds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileStack className="h-3 w-3" />
                          {recording.page_count} {recording.page_count === 1 ? "página" : "páginas"}
                        </span>
                      </div>
                      {recording.pages_visited && recording.pages_visited.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {recording.pages_visited.join(" → ")}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Player */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t("admin.analytics.sessionPlayer", "Reprodutor de Sessão")}</CardTitle>
              {selectedRecording && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedRecording(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRecording ? (
              <div className="h-[450px] flex items-center justify-center bg-muted rounded-lg">
                <div className="text-center text-muted-foreground">
                  <Play className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{t("admin.analytics.selectRecording", "Selecione uma gravação para reproduzir")}</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <Badge variant="outline">
                    {getDeviceIcon(selectedRecording.device_type)}
                    <span className="ml-1 capitalize">{selectedRecording.device_type}</span>
                  </Badge>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDuration(selectedRecording.duration_seconds)}
                  </Badge>
                  <Badge variant="outline">
                    <FileStack className="h-3 w-3 mr-1" />
                    {selectedRecording.page_count} páginas
                  </Badge>
                  {selectedRecording.is_bounce && (
                    <Badge variant="destructive">Bounce</Badge>
                  )}
                  {selectedRecording.country && (
                    <Badge variant="outline">{selectedRecording.country}</Badge>
                  )}
                </div>
                <div 
                  ref={playerContainerRef} 
                  className="bg-muted rounded-lg overflow-hidden"
                  style={{ minHeight: "450px" }}
                />
                {selectedRecording.pages_visited && selectedRecording.pages_visited.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">{t("admin.analytics.pagesVisited", "Páginas visitadas")}:</p>
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      {selectedRecording.pages_visited.map((page, index) => (
                        <div key={index} className="flex items-center">
                          <Badge variant="secondary">{page}</Badge>
                          {index < selectedRecording.pages_visited.length - 1 && (
                            <SkipForward className="h-3 w-3 mx-1 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
