import { Shield } from "lucide-react";

export function TrustBadge() {
  return <Shield className="h-4 w-4 text-primary" />;
}

interface TrustMessageProps {
  messageKey?: string;
}

const trustMessages: Record<string, string> = {
  escrowProtection: "Pagamentos protegidos por escrow",
  releaseOnApproval: "Liberação de valores somente com aprovação",
};

export function TrustMessage({ messageKey }: TrustMessageProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Shield className="h-4 w-4 text-primary" />
      <span>{trustMessages[messageKey || ""] || "Plataforma segura com pagamentos protegidos"}</span>
    </div>
  );
}
