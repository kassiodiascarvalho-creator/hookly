import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CompanyWalletCard() {
  return (
    <Card>
      <CardHeader><CardTitle>Carteira da Empresa</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Componente em sincronização.</CardContent>
    </Card>
  );
}
