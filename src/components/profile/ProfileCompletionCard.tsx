import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProfileCompletionCardProps {
  userType?: "company" | "freelancer";
  completionPercent?: number;
}

export function ProfileCompletionCard({ completionPercent = 0 }: ProfileCompletionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={completionPercent} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">{completionPercent}% completo</p>
      </CardContent>
    </Card>
  );
}
