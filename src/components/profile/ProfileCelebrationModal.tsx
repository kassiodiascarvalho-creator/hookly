interface ProfileCelebrationModalProps {
  open: boolean;
  onClose: () => void;
  bonusCredits?: number;
  userType?: "company" | "freelancer";
}

export function ProfileCelebrationModal({ open }: ProfileCelebrationModalProps) {
  if (!open) return null;
  return null;
}
