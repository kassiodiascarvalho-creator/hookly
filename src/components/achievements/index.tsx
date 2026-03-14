import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export function AchievementsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          Conquistas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Complete seu perfil para desbloquear conquistas!</p>
      </CardContent>
    </Card>
  );
}
