interface ProjectPrefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  budgetMax: number;
  currency: string;
  onPrefundComplete?: () => void;
  onSkip?: () => void;
}

export function ProjectPrefundModal({ open }: ProjectPrefundModalProps) {
  if (!open) return null;
  return null;
}
