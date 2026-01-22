import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Award, ThumbsUp, Minus, AlertTriangle, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type AIRecommendationLevel = "primary" | "high" | "medium" | "low" | "pending";

interface ProposalAIBadgeProps {
  level: AIRecommendationLevel;
  score?: number;
  showScore?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const levelConfig: Record<AIRecommendationLevel, {
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  borderClass: string;
  glowClass?: string;
}> = {
  primary: {
    labelKey: "ai.primaryRecommendation",
    icon: Crown,
    badgeClass: "bg-green-600 text-white hover:bg-green-700",
    borderClass: "border-green-500 border-2",
    glowClass: "shadow-[0_0_12px_rgba(34,197,94,0.3)]",
  },
  high: {
    labelKey: "ai.highlyRecommended",
    icon: Award,
    badgeClass: "bg-green-500/20 text-green-700 border-green-500/50",
    borderClass: "border-green-400",
  },
  medium: {
    labelKey: "ai.compatible",
    icon: ThumbsUp,
    badgeClass: "bg-blue-500/20 text-blue-700 border-blue-500/50",
    borderClass: "border-blue-400/50",
  },
  low: {
    labelKey: "ai.notRecommended",
    icon: AlertTriangle,
    badgeClass: "bg-red-500/20 text-red-700 border-red-500/50",
    borderClass: "border-red-400",
  },
  pending: {
    labelKey: "ai.analysisPending",
    icon: HelpCircle,
    badgeClass: "bg-muted text-muted-foreground",
    borderClass: "border-muted",
  },
};

export function getAILevel(score: number | null | undefined, isTopPick: boolean): AIRecommendationLevel {
  if (score === null || score === undefined) return "pending";
  if (isTopPick && score >= 85) return "primary";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getScoreColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export function ProposalAIBadge({ level, score, showScore = false, compact = false, onClick }: ProposalAIBadgeProps) {
  const { t } = useTranslation();
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-center gap-2",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity"
      )}
      onClick={onClick}
    >
      <Badge className={cn("gap-1", config.badgeClass)} variant="outline">
        <Icon className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
        {!compact && <span>{t(config.labelKey)}</span>}
      </Badge>
      
      {showScore && score !== undefined && level !== "pending" && (
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold">{score}</span>
          <Progress 
            value={score} 
            className="w-12 h-1.5"
          />
        </div>
      )}
    </div>
  );
}

export function getProposalBorderClass(level: AIRecommendationLevel): string {
  return cn(levelConfig[level].borderClass, levelConfig[level].glowClass);
}

export function ProposalAIReasons({ reasons, maxReasons = 3 }: { reasons: string[]; maxReasons?: number }) {
  if (!reasons || reasons.length === 0) return null;

  return (
    <div className="flex items-start gap-1.5 mt-2">
      <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
      <ul className="text-xs text-muted-foreground space-y-0.5">
        {reasons.slice(0, maxReasons).map((reason, idx) => (
          <li key={idx}>• {reason}</li>
        ))}
      </ul>
    </div>
  );
}
