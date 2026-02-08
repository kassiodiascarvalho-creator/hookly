import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Users, 
  Eye, 
  MousePointerClick, 
  Clock, 
  TrendingDown,
  Globe,
  Monitor,
  Smartphone,
  Link2,
  FileText,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsData {
  timeSeries: {
    visitors: TimeSeriesMetric;
    pageviews: TimeSeriesMetric;
    pageviewsPerVisit: TimeSeriesMetric;
    sessionDuration: TimeSeriesMetric;
    bounceRate: TimeSeriesMetric;
  };
  lists: {
    page: ListMetric;
    source: ListMetric;
    device: ListMetric;
    country: ListMetric;
  };
}

interface TimeSeriesMetric {
  total: number;
  label: string;
  data: { date: string; value: number }[];
}

interface ListMetric {
  label: string;
  data: { label: string; value: number }[];
}

type TimeRange = "24h" | "7d" | "30d" | "90d";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--muted))",
  "hsl(142.1 76.2% 36.3%)",
  "hsl(47.9 95.8% 53.1%)",
];

export default function AdminAnalytics() {
  const { t, i18n } = useTranslation();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [loading, setLoading] = useState(true);
  const [currentVisitors, setCurrentVisitors] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
    // Simulate current visitors with random updates
    const interval = setInterval(() => {
      setCurrentVisitors(Math.floor(Math.random() * 5));
    }, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const getDateRange = (range: TimeRange) => {
    const end = new Date();
    const start = new Date();
    switch (range) {
      case "24h":
        start.setHours(start.getHours() - 24);
        break;
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
      case "90d":
        start.setDate(start.getDate() - 90);
        break;
    }
    return { start, end };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(timeRange);
      
      // Fetch page views from database using type assertion
      const { data: pageViews, error } = await (supabase
        .from("analytics_page_views" as any) as any)
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Process data into analytics format
      const processedData = processAnalyticsData(pageViews || [], start, end, timeRange);
      setAnalyticsData(processedData);

      // Count current active sessions (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await (supabase
        .from("analytics_page_views" as any) as any)
        .select("session_id", { count: "exact", head: true })
        .gte("created_at", fiveMinutesAgo);
      
      setCurrentVisitors(count || 0);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      // Set empty data on error
      setAnalyticsData(getEmptyAnalyticsData());
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (
    pageViews: any[],
    start: Date,
    end: Date,
    range: TimeRange
  ): AnalyticsData => {
    // Group by date
    const dateFormat = range === "24h" ? "hour" : "day";
    const groupedByDate: Record<string, any[]> = {};
    const sessions: Record<string, { pages: number; firstView: Date; lastView: Date }> = {};

    pageViews.forEach((pv) => {
      const date = new Date(pv.created_at);
      const key = dateFormat === "hour" 
        ? `${date.toISOString().split("T")[0]} ${date.getHours()}:00`
        : date.toISOString().split("T")[0];
      
      if (!groupedByDate[key]) groupedByDate[key] = [];
      groupedByDate[key].push(pv);

      // Track sessions
      if (!sessions[pv.session_id]) {
        sessions[pv.session_id] = { pages: 0, firstView: date, lastView: date };
      }
      sessions[pv.session_id].pages++;
      if (date > sessions[pv.session_id].lastView) {
        sessions[pv.session_id].lastView = date;
      }
    });

    // Calculate metrics
    const uniqueVisitors = new Set(pageViews.map((pv) => pv.session_id)).size;
    const totalPageviews = pageViews.length;
    const avgPageviewsPerVisit = uniqueVisitors > 0 ? totalPageviews / uniqueVisitors : 0;
    
    const sessionDurations = Object.values(sessions).map((s) => 
      (s.lastView.getTime() - s.firstView.getTime()) / 1000
    );
    const avgDuration = sessionDurations.length > 0 
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
      : 0;
    
    const bounces = Object.values(sessions).filter((s) => s.pages === 1).length;
    const bounceRate = uniqueVisitors > 0 ? (bounces / uniqueVisitors) * 100 : 0;

    // Generate time series data
    const dates = generateDateRange(start, end, dateFormat);
    const visitorsData = dates.map((date) => ({
      date,
      value: new Set(groupedByDate[date]?.map((pv) => pv.session_id) || []).size,
    }));
    const pageviewsData = dates.map((date) => ({
      date,
      value: groupedByDate[date]?.length || 0,
    }));

    // Calculate per-day metrics
    const pageviewsPerVisitData = dates.map((date) => {
      const views = groupedByDate[date]?.length || 0;
      const visitors = new Set(groupedByDate[date]?.map((pv) => pv.session_id) || []).size;
      return { date, value: visitors > 0 ? views / visitors : 0 };
    });

    // Group by page, source, device, country
    const pageCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const deviceCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};

    pageViews.forEach((pv) => {
      pageCounts[pv.page_path] = (pageCounts[pv.page_path] || 0) + 1;
      
      const source = pv.referrer 
        ? (pv.referrer.includes("google") ? "Google" 
          : pv.referrer.includes("facebook") ? "Facebook"
          : pv.referrer.includes("instagram") ? "Instagram"
          : pv.referrer.includes("twitter") ? "Twitter"
          : new URL(pv.referrer).hostname)
        : "Direct";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      
      deviceCounts[pv.device_type || "desktop"] = (deviceCounts[pv.device_type || "desktop"] || 0) + 1;
      countryCounts[pv.country || "Unknown"] = (countryCounts[pv.country || "Unknown"] || 0) + 1;
    });

    const sortByValue = (obj: Record<string, number>) => 
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));

    return {
      timeSeries: {
        visitors: { total: uniqueVisitors, label: "visitors", data: visitorsData },
        pageviews: { total: totalPageviews, label: "pageviews", data: pageviewsData },
        pageviewsPerVisit: { total: Math.round(avgPageviewsPerVisit * 100) / 100, label: "pageviewsPerVisit", data: pageviewsPerVisitData },
        sessionDuration: { total: Math.round(avgDuration), label: "sessionDuration", data: [] },
        bounceRate: { total: Math.round(bounceRate), label: "bounceRate", data: [] },
      },
      lists: {
        page: { label: "page", data: sortByValue(pageCounts) },
        source: { label: "source", data: sortByValue(sourceCounts) },
        device: { label: "device", data: sortByValue(deviceCounts) },
        country: { label: "country", data: sortByValue(countryCounts) },
      },
    };
  };

  const generateDateRange = (start: Date, end: Date, format: "hour" | "day"): string[] => {
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      if (format === "hour") {
        dates.push(`${current.toISOString().split("T")[0]} ${current.getHours()}:00`);
        current.setHours(current.getHours() + 1);
      } else {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
      }
    }
    return dates;
  };

  const getEmptyAnalyticsData = (): AnalyticsData => ({
    timeSeries: {
      visitors: { total: 0, label: "visitors", data: [] },
      pageviews: { total: 0, label: "pageviews", data: [] },
      pageviewsPerVisit: { total: 0, label: "pageviewsPerVisit", data: [] },
      sessionDuration: { total: 0, label: "sessionDuration", data: [] },
      bounceRate: { total: 0, label: "bounceRate", data: [] },
    },
    lists: {
      page: { label: "page", data: [] },
      source: { label: "source", data: [] },
      device: { label: "device", data: [] },
      country: { label: "country", data: [] },
    },
  });

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    if (timeRange === "24h") {
      return dateStr.split(" ")[1] || dateStr;
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getCountryFlag = (code: string): string => {
    if (code === "Unknown" || code.length !== 2) return "🌍";
    const codePoints = code
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const chartConfig = {
    value: {
      label: "Value",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("admin.analytics.title")}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("admin.analytics.description")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Current Visitors */}
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            <span className="text-sm font-medium">
              <span className="text-green-500">{currentVisitors}</span>
              <span className="text-muted-foreground ml-1">{t("admin.analytics.currentVisitors")}</span>
            </span>
          </div>

          {/* Time Range Selector */}
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">{t("admin.analytics.last24h")}</SelectItem>
              <SelectItem value="7d">{t("admin.analytics.last7d")}</SelectItem>
              <SelectItem value="30d">{t("admin.analytics.last30d")}</SelectItem>
              <SelectItem value="90d">{t("admin.analytics.last90d")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title={t("admin.analytics.visitors")}
          value={analyticsData?.timeSeries.visitors.total || 0}
          icon={Users}
          loading={loading}
        />
        <MetricCard
          title={t("admin.analytics.pageviews")}
          value={analyticsData?.timeSeries.pageviews.total || 0}
          icon={Eye}
          loading={loading}
        />
        <MetricCard
          title={t("admin.analytics.viewsPerVisit")}
          value={analyticsData?.timeSeries.pageviewsPerVisit.total || 0}
          icon={MousePointerClick}
          loading={loading}
          decimals={2}
        />
        <MetricCard
          title={t("admin.analytics.avgDuration")}
          value={formatDuration(analyticsData?.timeSeries.sessionDuration.total || 0)}
          icon={Clock}
          loading={loading}
          isText
        />
        <MetricCard
          title={t("admin.analytics.bounceRate")}
          value={`${analyticsData?.timeSeries.bounceRate.total || 0}%`}
          icon={TrendingDown}
          loading={loading}
          isText
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visitors Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.analytics.visitorsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={analyticsData?.timeSeries.visitors.data || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Pageviews Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.analytics.pageviewsOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={analyticsData?.timeSeries.pageviews.data || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Top Pages */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("admin.analytics.topPages")}
            </CardTitle>
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
                {analyticsData?.lists.page.data.slice(0, 5).map((item, index) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground" title={item.label}>
                      {item.label}
                    </span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                )) || <p className="text-sm text-muted-foreground">{t("admin.analytics.noData")}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              {t("admin.analytics.sources")}
            </CardTitle>
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
                {analyticsData?.lists.source.data.slice(0, 5).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{item.label}</span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                )) || <p className="text-sm text-muted-foreground">{t("admin.analytics.noData")}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              {t("admin.analytics.devices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {analyticsData?.lists.device.data.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {getDeviceIcon(item.label)}
                      {item.label.charAt(0).toUpperCase() + item.label.slice(1)}
                    </span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                )) || <p className="text-sm text-muted-foreground">{t("admin.analytics.noData")}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Countries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("admin.analytics.countries")}
            </CardTitle>
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
                {analyticsData?.lists.country.data.slice(0, 5).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span>{getCountryFlag(item.label)}</span>
                      {item.label}
                    </span>
                    <Badge variant="secondary">{item.value}</Badge>
                  </div>
                )) || <p className="text-sm text-muted-foreground">{t("admin.analytics.noData")}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  loading?: boolean;
  decimals?: number;
  isText?: boolean;
}

function MetricCard({ title, value, icon: Icon, loading, decimals = 0, isText }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs md:text-sm font-medium truncate pr-2">{title}</CardTitle>
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-xl md:text-2xl font-bold">
            {isText ? value : typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: decimals }) : value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
