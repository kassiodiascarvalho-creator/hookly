import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor } from "lucide-react";

export function SessionReplayTab() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Session Replay
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Monitor className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Gravação de sessão desativada
          </h3>
          <p className="text-muted-foreground max-w-md">
            A gravação de sessão (rrweb) foi desativada para melhorar a performance do site. 
            Os demais recursos de analytics (eventos, heatmap, funil) continuam ativos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
