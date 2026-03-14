interface WithdrawalRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
  availableBalance?: number;
  earningsAvailableMajor?: number;
  currency?: string;
  payoutMethods?: unknown[];
}

export function WithdrawalRequestModal({ open, onOpenChange }: WithdrawalRequestModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <p className="text-sm text-muted-foreground">Solicitação de saque em sincronização.</p>
        <button
          type="button"
          className="mt-4 text-sm text-primary"
          onClick={() => onOpenChange(false)}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
