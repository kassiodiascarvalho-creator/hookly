import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface GeniusRankingButtonProps {
  projectId?: string;
  proposalsCount?: number;
  onComplete?: () => void;
  onRankingGenerated?: () => void;
}

interface GeniusProposalButtonProps {
  projectId?: string;
  onProposalGenerated?: (text: string) => void;
}

export function GeniusRankingButton({ onComplete, onRankingGenerated }: GeniusRankingButtonProps) {
  const handleClick = () => {
    onComplete?.();
    onRankingGenerated?.();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Sparkles className="mr-2 h-4 w-4" />
      AI Ranking
    </Button>
  );
}

export function GeniusProposalButton({ onProposalGenerated }: GeniusProposalButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => onProposalGenerated?.("")}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      AI Proposal
    </Button>
  );
}
