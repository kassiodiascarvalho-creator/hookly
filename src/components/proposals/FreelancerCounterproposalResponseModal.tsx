interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: any;
  onAccepted?: () => void;
}

export function FreelancerCounterproposalResponseModal({ open, onOpenChange }: Props) {
  if (!open) return null;
  return null;
}
