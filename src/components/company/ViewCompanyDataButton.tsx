import { Button } from "@/components/ui/button";

export function ViewCompanyDataButton({ companyUserId, companyName }: { companyUserId: string; companyName?: string | null }) {
  return (
    <Button variant="outline" size="sm">
      Ver dados de {companyName || companyUserId}
    </Button>
  );
}
