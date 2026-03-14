interface CreditCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionName?: string;
  requiredCredits?: number;
  currentBalance?: number;
}

export function CreditCheckModal({ open }: CreditCheckModalProps) {
  if (!open) return null;
  return null;
}
