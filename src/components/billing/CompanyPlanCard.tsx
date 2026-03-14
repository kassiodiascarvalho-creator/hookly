import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";

export function CompanyPlanCard() {
  const { currentPlan } = useCompanyPlan();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano: {currentPlan}</CardTitle>
      </CardHeader>
    </Card>
  );
}
