import { Shield } from "lucide-react";

export function TrustBadge() {
  return <Shield className="h-4 w-4 text-primary" />;
}

export function TrustMessage() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Shield className="h-4 w-4 text-primary" />
      <span>Plataforma segura com pagamentos protegidos</span>
    </div>
  );
}
