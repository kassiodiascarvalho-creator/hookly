import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

export function VerifiedPaymentBadge({ size = "md", showLabel = false }: { size?: "sm" | "md"; showLabel?: boolean }) {
  return (
    <Badge variant="outline" className={size === "sm" ? "text-xs" : "text-sm"}>
      <ShieldCheck className="mr-1 h-3 w-3" />
      {showLabel ? "Pagamento verificado" : "Verificado"}
    </Badge>
  );
}
