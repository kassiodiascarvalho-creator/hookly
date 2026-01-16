import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, AlertTriangle, ShoppingCart } from "lucide-react";

interface CreditCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionName: string;
  requiredCredits: number;
  currentBalance: number;
}

export function CreditCheckModal({
  open,
  onOpenChange,
  actionName,
  requiredCredits,
  currentBalance,
}: CreditCheckModalProps) {
  const navigate = useNavigate();
  const insufficientCredits = currentBalance < requiredCredits;

  const handleBuyCredits = () => {
    onOpenChange(false);
    navigate("/settings?tab=billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {insufficientCredits ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Créditos Insuficientes
              </>
            ) : (
              <>
                <Coins className="h-5 w-5 text-primary" />
                Confirmar Ação
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {insufficientCredits
              ? `Você precisa de ${requiredCredits} crédito(s) para "${actionName}", mas possui apenas ${currentBalance}.`
              : `Esta ação irá consumir ${requiredCredits} crédito(s) do seu saldo.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ação</span>
              <span className="font-medium">{actionName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Custo</span>
              <span className="font-medium">{requiredCredits} crédito(s)</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">Seu saldo</span>
              <span className={`font-bold ${insufficientCredits ? "text-destructive" : "text-green-600"}`}>
                {currentBalance} crédito(s)
              </span>
            </div>
            {!insufficientCredits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo após</span>
                <span className="font-medium">{currentBalance - requiredCredits} crédito(s)</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {insufficientCredits ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBuyCredits} className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Comprar Créditos
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
