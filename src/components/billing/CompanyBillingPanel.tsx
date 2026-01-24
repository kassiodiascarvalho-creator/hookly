import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CreditCard, FileText, AlertTriangle, Calendar, 
  ExternalLink, Download, RefreshCw, Loader2, Receipt
} from "lucide-react";
import { useCompanyBilling, StripeInvoice } from "@/hooks/useCompanyBilling";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat(i18n.language === "pt" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
};

const getStatusBadge = (status: string | null) => {
  const statusColors: Record<string, string> = {
    paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    open: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    draft: "bg-muted text-muted-foreground",
    uncollectible: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    void: "bg-muted text-muted-foreground line-through",
  };
  return (
    <Badge className={statusColors[status || "draft"] || statusColors.draft}>
      {status?.toUpperCase() || "DRAFT"}
    </Badge>
  );
};

export function CompanyBillingPanel() {
  const { t } = useTranslation();
  const { summary, loading, error, refetch, openCustomerPortal } = useCompanyBilling();
  const [managingPortal, setManagingPortal] = useState(false);
  const locale = i18n.language === "pt" ? ptBR : enUS;

  const handleManagePayment = async () => {
    try {
      setManagingPortal(true);
      await openCustomerPortal();
    } catch (err) {
      toast.error(t("billing.errorOpeningPortal"));
    } finally {
      setManagingPortal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{t("billing.errorLoading")}</span>
          </div>
          <Button variant="outline" onClick={refetch} className="mt-4 gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const isPastDue = summary.subscription?.status === "past_due";
  const hasStripeData = summary.hasStripeCustomer && summary.invoices.length > 0;

  return (
    <div className="space-y-6">
      {/* Subscription Status Alert */}
      {isPastDue && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">
                  {t("billing.pastDueWarning")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("billing.pastDueDescription")}
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={handleManagePayment}>
                {t("billing.updatePayment")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Info */}
      {summary.subscription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              {t("billing.subscriptionInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("billing.status")}</span>
              <Badge variant={summary.subscription.status === "active" ? "default" : "secondary"}>
                {summary.subscription.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("billing.currentPeriod")}</span>
              <span>
                {format(new Date(summary.subscription.current_period_start), "d MMM", { locale })}
                {" - "}
                {format(new Date(summary.subscription.current_period_end), "d MMM yyyy", { locale })}
              </span>
            </div>
            {summary.subscription.cancel_at_period_end && (
              <div className="flex justify-between items-center text-amber-600">
                <span>{t("billing.cancelsAt")}</span>
                <span>
                  {format(new Date(summary.subscription.current_period_end), "d MMM yyyy", { locale })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Invoice */}
      {summary.upcomingInvoice && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" />
              {t("billing.upcomingCharge")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary.upcomingInvoice.amount_due, summary.upcomingInvoice.currency)}
                </p>
                {summary.upcomingInvoice.period_end && (
                  <p className="text-sm text-muted-foreground">
                    {t("billing.dueOn")} {format(new Date(summary.upcomingInvoice.period_end), "d MMM yyyy", { locale })}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("billing.invoiceHistory")}
              </CardTitle>
              <CardDescription>{t("billing.invoiceHistoryDesc")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refetch} className="gap-1">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasStripeData ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("billing.noInvoicesYet")}</p>
              <p className="text-sm">{t("billing.noInvoicesDesc")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("billing.invoice")}</TableHead>
                  <TableHead>{t("billing.date")}</TableHead>
                  <TableHead>{t("billing.amount")}</TableHead>
                  <TableHead>{t("billing.status")}</TableHead>
                  <TableHead className="text-right">{t("billing.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.invoices.map((invoice: StripeInvoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.number || invoice.id.slice(-8)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.created), "d MMM yyyy", { locale })}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(invoice.amount_due, invoice.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {invoice.hosted_invoice_url && invoice.status === "open" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.hosted_invoice_url!, "_blank")}
                            className="gap-1 text-primary"
                          >
                            {t("billing.pay")}
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        {invoice.invoice_pdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.invoice_pdf!, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            {t("billing.paymentMethod")}
          </CardTitle>
          <CardDescription>{t("billing.paymentMethodDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleManagePayment} 
            disabled={managingPortal}
            className="gap-2"
          >
            {managingPortal ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {t("billing.managePaymentMethod")}
            <ExternalLink className="h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
