import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface CurrencyAmount {
  currency: string;
  amount: number;
}

interface PendingCommitmentsCardProps {
  byCurrency: CurrencyAmount[];
  contracts: any[];
  totalContracts: number;
  loading: boolean;
  onPaymentComplete?: () => void;
}

interface UnfundedPotentialCardProps {
  byCurrency: CurrencyAmount[];
  projects: any[];
  totalProjects: number;
  loading: boolean;
  onPaymentComplete?: () => void;
}

export function PendingCommitmentsCard({ totalContracts, loading }: PendingCommitmentsCardProps) {
  if (loading) return <Card><CardContent className="pt-6"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Compromissos Pendentes</CardTitle></CardHeader>
      <CardContent><p>{totalContracts} contratos</p></CardContent>
    </Card>
  );
}

export function UnfundedPotentialCard({ totalProjects, loading }: UnfundedPotentialCardProps) {
  if (loading) return <Card><CardContent className="pt-6"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle>Potencial Não Financiado</CardTitle></CardHeader>
      <CardContent><p>{totalProjects} projetos</p></CardContent>
    </Card>
  );
}
