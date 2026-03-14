import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IdentityVerificationCard({ subjectType }: { subjectType: "company" | "freelancer" }) {
  return (
    <Card>
      <CardHeader><CardTitle>Verificação de identidade</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Tipo: {subjectType}</CardContent>
    </Card>
  );
}
