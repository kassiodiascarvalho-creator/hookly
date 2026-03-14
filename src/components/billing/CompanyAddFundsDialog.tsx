import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CompanyAddFundsDialog({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onSuccess}>
      <Plus className="h-4 w-4 mr-2" />
      Adicionar Fundos
    </Button>
  );
}
