import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { Download, RefreshCw, TrendingUp, ArrowRightLeft, Calendar } from "lucide-react";
import { subDays, subMonths, startOfDay, endOfDay, format } from "date-fns";

interface FxRevenueData {
  payment_currency: string;
  total_spread_usd: number;
  transaction_count: number;
  avg_spread_percent: number;
}

interface InflowOutflowData {
  period: string;
  inflows_usd: number;
  outflows_usd: number;
  net_usd: number;
}

type DateRange = "7days" | "30days" | "90days" | "1year" | "all";

export default function FxRevenueReport() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30days");
  const [fxRevenue, setFxRevenue] = useState<FxRevenueData[]>([]);
  const [totalFxRevenue, setTotalFxRevenue] = useState(0);
  const [inflowOutflow, setInflowOutflow] = useState<InflowOutflowData[]>([]);

  const getDateRange = (range: DateRange): { start: Date | null; end: Date } => {
    const now = new Date();
    const end = endOfDay(now);
    
    switch (range) {
      case "7days": return { start: startOfDay(subDays(now, 7)), end };
      case "30days": return { start: startOfDay(subMonths(now, 1)), end };
      case "90days": return { start: startOfDay(subMonths(now, 3)), end };
      case "1year": return { start: startOfDay(subMonths(now, 12)), end };
      case "all":
      default: return { start: null, end };
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const { start } = getDateRange(dateRange);

    try {
      // Fetch FX spread revenue from unified_payments
      let fxQuery = supabase
        .from("unified_payments")
        .select("payment_currency, fx_spread_amount_usd_minor, fx_spread_percent")
        .not("fx_spread_amount_usd_minor", "is", null)
        .gt("fx_spread_amount_usd_minor", 0);

      if (start) {
        fxQuery = fxQuery.gte("created_at", start.toISOString());
      }

      const { data: fxData } = await fxQuery;

      // Group by currency
      const currencyMap = new Map<string, { total: number; count: number; spreadSum: number }>();
      let totalSpread = 0;

      (fxData || []).forEach((item) => {
        const currency = item.payment_currency || "USD";
        const spread = Number(item.fx_spread_amount_usd_minor || 0);
        const spreadPercent = Number(item.fx_spread_percent || 0);
        
        totalSpread += spread;
        
        if (!currencyMap.has(currency)) {
          currencyMap.set(currency, { total: 0, count: 0, spreadSum: 0 });
        }
        const existing = currencyMap.get(currency)!;
        existing.total += spread;
        existing.count += 1;
        existing.spreadSum += spreadPercent;
      });

      const fxRevenueByCurrency: FxRevenueData[] = Array.from(currencyMap.entries())
        .map(([currency, data]) => ({
          payment_currency: currency,
          total_spread_usd: data.total,
          transaction_count: data.count,
          avg_spread_percent: data.spreadSum / data.count,
        }))
        .sort((a, b) => b.total_spread_usd - a.total_spread_usd);

      setFxRevenue(fxRevenueByCurrency);
      setTotalFxRevenue(totalSpread);

      // Fetch inflows vs outflows from ledger_transactions
      let inflowQuery = supabase
        .from("ledger_transactions")
        .select("tx_type, amount_usd_minor, amount, created_at");

      if (start) {
        inflowQuery = inflowQuery.gte("created_at", start.toISOString());
      }

      const { data: flowData } = await inflowQuery;

      // Group by month/period
      const flowMap = new Map<string, { inflows: number; outflows: number }>();
      
      (flowData || []).forEach((tx) => {
        const date = new Date(tx.created_at);
        const period = format(date, "yyyy-MM");
        
        if (!flowMap.has(period)) {
          flowMap.set(period, { inflows: 0, outflows: 0 });
        }
        
        const flow = flowMap.get(period)!;
        const amount = Number(tx.amount_usd_minor || tx.amount || 0);
        
        // Inflows: topups, contract funding
        if (["topup_credit", "contract_funding"].includes(tx.tx_type)) {
          flow.inflows += Math.abs(amount);
        }
        // Outflows: withdrawals
        if (["withdrawal_paid"].includes(tx.tx_type)) {
          flow.outflows += Math.abs(amount);
        }
      });

      const inflowOutflowData: InflowOutflowData[] = Array.from(flowMap.entries())
        .map(([period, data]) => ({
          period,
          inflows_usd: data.inflows,
          outflows_usd: data.outflows,
          net_usd: data.inflows - data.outflows,
        }))
        .sort((a, b) => b.period.localeCompare(a.period));

      setInflowOutflow(inflowOutflowData);
    } catch (error) {
      console.error("Error fetching FX report:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    // FX Revenue CSV
    const fxHeaders = ["Moeda", "Receita Spread (USD)", "Transações", "Spread Médio (%)"];
    const fxRows = fxRevenue.map((row) => [
      row.payment_currency,
      (row.total_spread_usd / 100).toFixed(2),
      row.transaction_count,
      (row.avg_spread_percent * 100).toFixed(2),
    ]);

    const flowHeaders = ["Período", "Entradas (USD)", "Saídas (USD)", "Saldo (USD)"];
    const flowRows = inflowOutflow.map((row) => [
      row.period,
      (row.inflows_usd / 100).toFixed(2),
      (row.outflows_usd / 100).toFixed(2),
      (row.net_usd / 100).toFixed(2),
    ]);

    const csvContent = [
      "RELATÓRIO FX - RECEITA POR SPREAD",
      "",
      fxHeaders.join(","),
      ...fxRows.map((row) => row.join(",")),
      "",
      "",
      "ENTRADAS VS SAÍDAS",
      "",
      flowHeaders.join(","),
      ...flowRows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fx-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const totals = useMemo(() => {
    const totalInflows = inflowOutflow.reduce((sum, row) => sum + row.inflows_usd, 0);
    const totalOutflows = inflowOutflow.reduce((sum, row) => sum + row.outflows_usd, 0);
    return { totalInflows, totalOutflows, net: totalInflows - totalOutflows };
  }, [inflowOutflow]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Relatório Financeiro
          </h2>
          <p className="text-muted-foreground">Receita FX e fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">7 dias</SelectItem>
              <SelectItem value="30days">30 dias</SelectItem>
              <SelectItem value="90days">3 meses</SelectItem>
              <SelectItem value="1year">1 ano</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={exportCSV} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Receita FX Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatMoneyFromCents(totalFxRevenue, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Ganho com spread de câmbio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoneyFromCents(totals.totalInflows, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Top-ups + Contratos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatMoneyFromCents(totals.totalOutflows, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Saques pagos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoneyFromCents(totals.net, "USD")}
            </div>
            <p className="text-xs text-muted-foreground">Entradas - Saídas</p>
          </CardContent>
        </Card>
      </div>

      {/* FX Revenue by Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Receita FX por Moeda de Origem
          </CardTitle>
          <CardDescription>
            Detalhamento do ganho com spread de conversão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Moeda</TableHead>
                <TableHead className="text-right">Receita Spread (USD)</TableHead>
                <TableHead className="text-right">Transações</TableHead>
                <TableHead className="text-right">Spread Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : fxRevenue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação com conversão encontrada
                  </TableCell>
                </TableRow>
              ) : (
                fxRevenue.map((row) => (
                  <TableRow key={row.payment_currency}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {row.payment_currency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-purple-600">
                      {formatMoneyFromCents(row.total_spread_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.transaction_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.avg_spread_percent * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inflow vs Outflow by Period */}
      <Card>
        <CardHeader>
          <CardTitle>Entradas vs Saídas por Período</CardTitle>
          <CardDescription>
            Fluxo de caixa mensal (valores em USD)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Entradas (USD)</TableHead>
                <TableHead className="text-right">Saídas (USD)</TableHead>
                <TableHead className="text-right">Saldo (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : inflowOutflow.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                inflowOutflow.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="font-medium">{row.period}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatMoneyFromCents(row.inflows_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {formatMoneyFromCents(row.outflows_usd, "USD")}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${row.net_usd >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatMoneyFromCents(row.net_usd, "USD")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}