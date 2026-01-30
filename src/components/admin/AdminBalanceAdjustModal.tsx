import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AdminBalanceAdjustModalProps {
  userId: string | null;
  userName: string;
  currentBalance: number;
  currentCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AdminBalanceAdjustModal({
  userId,
  userName,
  currentBalance,
  currentCurrency,
  open,
  onOpenChange,
  onSuccess,
}: AdminBalanceAdjustModalProps) {
  const [loading, setLoading] = useState(false);
  const [newBalance, setNewBalance] = useState(currentBalance.toString());
  const [newCurrency, setNewCurrency] = useState(currentCurrency);
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    if (!userId) return;

    const balanceValue = parseFloat(newBalance);
    if (isNaN(balanceValue) || balanceValue < 0) {
      toast.error("Valor inválido");
      return;
    }

    if (!reason.trim()) {
      toast.error("Informe o motivo do ajuste");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "admin_adjust_user_balance" as any,
        {
          p_user_id: userId,
          p_currency: newCurrency,
          p_earnings_available: balanceValue,
          p_reason: reason.trim(),
        }
      );

      if (error) throw error;

      toast.success("Saldo ajustado com sucesso");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error adjusting balance:", error);
      toast.error(error.message || "Erro ao ajustar saldo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Saldo</DialogTitle>
          <DialogDescription>
            Ajuste manual do saldo de {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Atual</Label>
            <div className="col-span-3 text-muted-foreground">
              {currentBalance.toFixed(2)} {currentCurrency}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="currency" className="text-right">
              Moeda
            </Label>
            <Select value={newCurrency} onValueChange={setNewCurrency}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="balance" className="text-right">
              Novo Saldo
            </Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              min="0"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              className="col-span-3"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="reason" className="text-right">
              Motivo
            </Label>
            <Textarea
              id="reason"
              placeholder="Descreva o motivo do ajuste..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
