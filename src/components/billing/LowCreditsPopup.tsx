import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins, Plus, X } from "lucide-react";
import { usePlatformCredits } from "@/hooks/usePlatformCredits";

const STORAGE_KEY = "low_credits_popup_dismissed_at";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOW_CREDITS_THRESHOLD = 5;

interface LowCreditsPopupProps {
  onBuyCredits?: () => void;
}

export function LowCreditsPopup({ onBuyCredits }: LowCreditsPopupProps) {
  const { user } = useAuth();
  const { balance, loading } = usePlatformCredits();
  const [open, setOpen] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);

  // Fetch user type on mount
  useEffect(() => {
    if (!user) return;
    
    supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setUserType(data?.user_type || null);
      });
  }, [user]);

  useEffect(() => {
    if (loading || !user || !userType) return;

    // Check if credits are low
    if (balance > LOW_CREDITS_THRESHOLD) return;

    // Check cooldown
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < COOLDOWN_MS) {
        return; // Still in cooldown
      }
    }

    // Show popup
    setOpen(true);
  }, [balance, loading, user, userType]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setOpen(false);
  };

  const handleBuyCredits = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setOpen(false);
    onBuyCredits?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Coins className="h-5 w-5" />
            Créditos Baixos
          </DialogTitle>
          <DialogDescription>
            Você tem apenas <strong>{balance}</strong> créditos restantes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 p-4">
            <p className="text-sm">
              Seus créditos estão acabando! Recarregue agora para continuar enviando propostas
              e usando os recursos da plataforma.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Lembrar depois
            </Button>
            <Button
              onClick={handleBuyCredits}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Comprar Créditos
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Você não verá este aviso novamente nas próximas 24 horas
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
