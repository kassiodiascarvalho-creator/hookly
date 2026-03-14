import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function GeniusRankingButton({ projectId, onComplete }: { projectId?: string; onComplete?: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onComplete}>
      <Sparkles className="h-4 w-4 mr-2" />
      AI Ranking
    </Button>
  );
}
