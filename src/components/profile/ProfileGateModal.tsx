interface ProfileGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userType?: "company" | "freelancer";
  completionPercent?: number;
}

export function ProfileGateModal({ open }: ProfileGateModalProps) {
  if (!open) return null;
  return null;
}
