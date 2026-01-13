import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { AlertTriangle, Shield, RefreshCw, CheckCircle } from "lucide-react";

interface Alert {
  id: string;
  type: "rate_anomaly" | "spread_limit" | "currency_mismatch" | "large_transaction";
  severity: "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
  created_at: string;
}

// Known fallback rates for anomaly detection
const EXPECTED_RATES: Record<string, number> = {
  BRL: 0.17,
  EUR: 1.08,
  GBP: 1.26,
  JPY: 0.0067,
  MXN: 0.056,
};

const RATE_TOLERANCE = 0.15; // 15% tolerance
const MAX_SPREAD = 0.05; // 5% max spread
const LARGE_TRANSACTION_THRESHOLD = 1000000; // $10,000 in cents

export default function FinancialAlertsCard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runAuditChecks();
  }, []);

  const runAuditChecks = async () => {
    setLoading(true);
    const newAlerts: Alert[] = [];

    try {
      // Check for rate anomalies
      const { data: recentPayments } = await supabase
        .from("unified_payments")
        .select("id, payment_currency, fx_rate_market, fx_rate_source, amount_usd_minor, created_at")
        .not("fx_rate_market", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);

      (recentPayments || []).forEach((payment) => {
        const currency = payment.payment_currency;
        const rate = payment.fx_rate_market;
        const expected = EXPECTED_RATES[currency];

        if (expected && rate) {
          const diff = Math.abs(rate - expected) / expected;
          if (diff > RATE_TOLERANCE) {
            newAlerts.push({
              id: `rate-${payment.id}`,
              type: "rate_anomaly",
              severity: diff > 0.3 ? "critical" : "warning",
              message: `Taxa FX anômala para ${currency}: ${rate.toFixed(4)} (esperado ~${expected.toFixed(4)})`,
              details: { payment_id: payment.id, currency, actual_rate: rate, expected_rate: expected, diff_percent: (diff * 100).toFixed(1) },
              created_at: payment.created_at,
            });
          }
        }

        // Check for fallback rates being used
        if (payment.fx_rate_source === "fallback") {
          newAlerts.push({
            id: `fallback-${payment.id}`,
            type: "rate_anomaly",
            severity: "warning",
            message: `Pagamento usou taxa fallback: ${payment.payment_currency} ${formatMoneyFromCents(payment.amount_usd_minor, "USD")}`,
            details: { payment_id: payment.id, source: "fallback" },
            created_at: payment.created_at,
          });
        }
      });

      // Check for spread violations
      const { data: spreads } = await supabase
        .from("fx_spread_configs")
        .select("currency_code, spread_percent")
        .gt("spread_percent", MAX_SPREAD);

      (spreads || []).forEach((config) => {
        newAlerts.push({
          id: `spread-${config.currency_code}`,
          type: "spread_limit",
          severity: "warning",
          message: `Spread para ${config.currency_code} (${(config.spread_percent * 100).toFixed(2)}%) excede limite de ${(MAX_SPREAD * 100)}%`,
          created_at: new Date().toISOString(),
        });
      });

      // Check for large transactions
      const { data: largeTransactions } = await supabase
        .from("unified_payments")
        .select("id, amount_usd_minor, payment_currency, created_at")
        .gt("amount_usd_minor", LARGE_TRANSACTION_THRESHOLD)
        .order("created_at", { ascending: false })
        .limit(10);

      (largeTransactions || []).forEach((tx) => {
        newAlerts.push({
          id: `large-${tx.id}`,
          type: "large_transaction",
          severity: "warning",
          message: `Transação grande: ${formatMoneyFromCents(tx.amount_usd_minor, "USD")} (${tx.payment_currency})`,
          details: { payment_id: tx.id },
          created_at: tx.created_at,
        });
      });

      // Deduplicate and sort by severity/date
      const uniqueAlerts = newAlerts.reduce((acc, alert) => {
        if (!acc.find((a) => a.id === alert.id)) {
          acc.push(alert);
        }
        return acc;
      }, [] as Alert[]);

      uniqueAlerts.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === "critical" ? -1 : 1;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setAlerts(uniqueAlerts.slice(0, 20)); // Keep top 20 alerts
    } catch (error) {
      console.error("Error running audit checks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: Alert["type"]) => {
    switch (type) {
      case "rate_anomaly":
      case "spread_limit":
        return <AlertTriangle className="h-4 w-4" />;
      case "large_transaction":
        return <Shield className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Alertas Antifraude
            </CardTitle>
            <CardDescription>
              Validações automáticas de transações e taxas
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={runAuditChecks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Verificar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
            <p className="font-medium text-green-600">Nenhum alerta detectado</p>
            <p className="text-sm text-muted-foreground">
              Todas as transações e taxas estão dentro dos limites esperados
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex gap-2 mb-4">
              {criticalCount > 0 && (
                <Badge variant="destructive">{criticalCount} crítico(s)</Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  {warningCount} aviso(s)
                </Badge>
              )}
            </div>

            {/* Alert list */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border flex items-start gap-3 ${
                    alert.severity === "critical"
                      ? "bg-red-50 border-red-200"
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div
                    className={`p-1 rounded ${
                      alert.severity === "critical"
                        ? "bg-red-100 text-red-600"
                        : "bg-yellow-100 text-yellow-600"
                    }`}
                  >
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge
                    variant={alert.severity === "critical" ? "destructive" : "outline"}
                    className="shrink-0"
                  >
                    {alert.type === "rate_anomaly" && "Taxa"}
                    {alert.type === "spread_limit" && "Spread"}
                    {alert.type === "large_transaction" && "Valor"}
                    {alert.type === "currency_mismatch" && "Moeda"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}