import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Coins, Gift, Receipt, TrendingUp } from "lucide-react";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { useCreditPurchases, CreditPurchaseSummary } from "@/hooks/useCreditPurchases";
import { useState } from "react";

type DateFilter = "7days" | "30days" | "all";

export function CreditRevenueCards() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const { loading, summary } = useCreditPurchases(dateFilter);

  const currencies = Object.keys(summary.total_revenue_by_currency);
  const primaryCurrency = currencies.includes("USD") ? "USD" : currencies[0] || "USD";

  const dateFilterLabels = {
    "7days": "7 dias",
    "30days": "30 dias",
    "all": "Todo período",
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Receita com Créditos</h3>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with date filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Receita com Créditos (Compras)</h3>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">7 dias</SelectItem>
            <SelectItem value="30days">30 dias</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Cash-in (Revenue) */}
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita (Cash-in)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {currencies.length <= 1 ? (
              <div className="text-2xl font-bold text-green-600">
                {formatMoneyFromCents(summary.total_revenue_by_currency[primaryCurrency] || 0, primaryCurrency)}
              </div>
            ) : (
              <div className="space-y-1">
                {currencies.map((currency) => (
                  <div key={currency} className="text-lg font-bold text-green-600">
                    {formatMoneyFromCents(summary.total_revenue_by_currency[currency], currency)}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Valor pago real • {summary.purchase_count} compras
            </p>
          </CardContent>
        </Card>

        {/* Credits Granted */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créditos Concedidos</CardTitle>
            <Coins className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.total_credits_granted.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unidades (base + bônus)
            </p>
          </CardContent>
        </Card>

        {/* Bonus Credits */}
        <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bônus Concedidos</CardTitle>
            <Gift className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summary.total_bonus_credits.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Créditos extras gratuitos
            </p>
          </CardContent>
        </Card>

        {/* Average Ticket */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {currencies.length <= 1 ? (
              <div className="text-2xl font-bold text-orange-600">
                {formatMoneyFromCents(summary.average_ticket_by_currency[primaryCurrency] || 0, primaryCurrency)}
              </div>
            ) : (
              <div className="space-y-1">
                {currencies.map((currency) => (
                  <div key={currency} className="text-lg font-bold text-orange-600">
                    {formatMoneyFromCents(summary.average_ticket_by_currency[currency], currency)}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Por compra confirmada
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
