interface SignupModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isOpen?: boolean;
  onClose?: () => void;
  type?: "company" | "freelancer";
}

export function SignupModal({ open, onOpenChange, isOpen, onClose }: SignupModalProps) {
  const resolvedOpen = typeof open === "boolean" ? open : !!isOpen;
  const handleOpenChange = onOpenChange || ((nextOpen: boolean) => {
    if (!nextOpen) onClose?.();
  });

  if (!resolvedOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <p className="text-sm text-muted-foreground">Signup modal em sincronização.</p>
        <button
          type="button"
          className="mt-4 text-sm text-primary"
          onClick={() => handleOpenChange(false)}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
