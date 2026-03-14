interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: any;
  project?: any;
  onAccepted?: () => void;
  onResponseSubmitted?: () => void;
  [key: string]: any;
}

export function FreelancerCounterproposalResponseModal({ open, onOpenChange }: Props) {
  if (!open) return null;
  return null;
}
