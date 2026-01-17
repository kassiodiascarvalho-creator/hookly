import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, CreditCard, QrCode, Wallet } from "lucide-react";
import { format } from "date-fns";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { fetchUserCreditStats, UserCreditStats } from "@/hooks/useCreditPurchases";

interface UserCreditStatementModalProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreditStatementModal({
  userId,
  open,
  onOpenChange,
}: UserCreditStatementModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<UserCreditStats | null>(null);

  useEffect(() => {
    if (userId && open) {
      setLoading(true);
      fetchUserCreditStats(userId)
        .then((data) => setStats(data))
        .finally(() => setLoading(false));
    } else {
      setStats(null);
    }
  }, [userId, open]);

  const getPaymentMethodIcon = (method: string | null) => {
    switch (method) {
      case "pix":
        return <QrCode className="h-4 w-4" />;
      case "card_br":
      case "card_international":
        return <CreditCard className="h-4 w-4" />;
      case "wallet":
        return <Wallet className="h-4 w-4" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "pix":
        return "PIX";
      case "card_br":
        return "Cartão BR";
      case "card_international":
        return "Cartão Int.";
      case "wallet":
        return "Carteira";
      default:
        return method || "-";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Extrato de Créditos
          </DialogTitle>
          <DialogDescription>
            Histórico de compras e saldo do usuário
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* User Info */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{stats.name || stats.email}</p>
                  <p className="text-sm text-muted-foreground">{stats.email}</p>
                </div>
                <Badge variant={stats.user_type === "company" ? "default" : "secondary"}>
                  {stats.user_type === "company" ? "Empresa" : "Freelancer"}
                </Badge>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                <p className="text-sm text-muted-foreground">Total Pago</p>
                <div className="space-y-1">
                  {Object.entries(stats.total_paid_by_currency).map(([currency, amount]) => (
                    <p key={currency} className="text-lg font-bold text-green-600">
                      {formatMoneyFromCents(amount, currency)}
                    </p>
                  ))}
                  {Object.keys(stats.total_paid_by_currency).length === 0 && (
                    <p className="text-lg font-bold text-green-600">$0.00</p>
                  )}
                </div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-muted-foreground">Créditos Recebidos</p>
                <p className="text-lg font-bold text-blue-600">
                  {stats.total_credits_granted.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                <p className="text-sm text-muted-foreground">Saldo Atual</p>
                <p className="text-lg font-bold text-purple-600">
                  {stats.current_balance.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Last Purchase */}
            {stats.last_purchase_at && (
              <p className="text-sm text-muted-foreground">
                Última compra: {format(new Date(stats.last_purchase_at), "dd/MM/yyyy HH:mm")}
              </p>
            )}

            {/* Purchases Table */}
            <div>
              <h4 className="font-medium mb-2">Últimas 20 Compras</h4>
              {stats.purchases.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma compra encontrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Créditos</TableHead>
                      <TableHead className="text-right">Bônus</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="text-sm">
                          {format(new Date(purchase.confirmed_at || purchase.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(purchase.payment_method)}
                            <span className="text-sm">
                              {getPaymentMethodLabel(purchase.payment_method)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoneyFromCents(purchase.amount_paid_minor, purchase.currency_paid)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {purchase.credits_granted}
                        </TableCell>
                        <TableCell className="text-right text-purple-600">
                          {purchase.bonus_credits > 0 ? `+${purchase.bonus_credits}` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Usuário não encontrado
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
