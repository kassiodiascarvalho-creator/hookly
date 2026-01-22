import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Loader2, DollarSign, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatMoney";
import { 
  ProposalAIBadge, 
  ProposalAIReasons, 
  getAILevel, 
  getProposalBorderClass 
} from "./ProposalAIBadge";
import type { ProposalRankingData } from "@/hooks/useProposalRankings";

interface Freelancer {
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  location: string | null;
  verified: boolean | null;
}

interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  freelancer_user_id: string;
  freelancer?: Freelancer | null;
}

interface ProposalCardProps {
  proposal: Proposal;
  currency: string;
  ranking?: ProposalRankingData | null;
  actionLoading: string | null;
  onAccept: (proposalId: string, freelancerUserId: string) => void;
  onReject: (proposalId: string, freelancerUserId: string) => void;
  onViewProfile: (freelancerUserId: string) => void;
  onOpenAIAnalysis?: () => void;
}

export function ProposalCard({
  proposal,
  currency,
  ranking,
  actionLoading,
  onAccept,
  onReject,
  onViewProfile,
  onOpenAIAnalysis,
}: ProposalCardProps) {
  const { t } = useTranslation();

  const aiLevel = ranking 
    ? getAILevel(ranking.score, ranking.isTopPick)
    : "pending";

  const borderClass = ranking ? getProposalBorderClass(aiLevel) : "";

  // Get top 3 reasons from strengths
  const aiReasons = ranking?.strengths?.slice(0, 3) || [];

  const handleAcceptWithWarning = () => {
    if (aiLevel === "low") {
      const confirmed = window.confirm(t("ai.proceedAnywayWarning"));
      if (!confirmed) return;
    }
    onAccept(proposal.id, proposal.freelancer_user_id);
  };

  return (
    <div 
      className={cn(
        "border rounded-lg p-4 transition-all",
        borderClass,
        ranking?.isTopPick && "bg-primary/5"
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={proposal.freelancer?.avatar_url || undefined} />
          <AvatarFallback>
            {proposal.freelancer?.full_name?.charAt(0) || "F"}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          {/* Header with name, badges, and AI recommendation */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h4 className="font-semibold">
              {proposal.freelancer?.full_name || "Freelancer"}
            </h4>
            {proposal.freelancer?.verified && (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                {t("common.verified", "Verified")}
              </Badge>
            )}
            <Badge 
              variant={proposal.status === "accepted" ? "default" : proposal.status === "rejected" ? "destructive" : "secondary"}
            >
              {proposal.status}
            </Badge>
          </div>

          {/* AI Recommendation Badge & Score */}
          {ranking && (
            <div className="mb-2">
              <ProposalAIBadge 
                level={aiLevel} 
                score={ranking.score}
                showScore={true}
                onClick={onOpenAIAnalysis}
              />
            </div>
          )}
          
          <p className="text-sm text-muted-foreground mb-2">
            {proposal.freelancer?.title}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
            {proposal.freelancer?.hourly_rate && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                ${proposal.freelancer.hourly_rate}/hr
              </span>
            )}
            {proposal.freelancer?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {proposal.freelancer.location}
              </span>
            )}
          </div>

          {proposal.cover_letter && (
            <p className="text-sm mb-3 line-clamp-3">{proposal.cover_letter}</p>
          )}

          {/* AI Quick Reasons */}
          {aiReasons.length > 0 && (
            <ProposalAIReasons reasons={aiReasons} maxReasons={3} />
          )}

          {proposal.milestones && Array.isArray(proposal.milestones) && proposal.milestones.length > 0 && (
            <div className="mb-3 mt-3">
              <p className="text-sm font-medium mb-1">{t("proposals.milestones")}:</p>
              <div className="flex flex-wrap gap-2">
                {(proposal.milestones as { title: string; amount: number }[]).map((m, idx) => (
                  <Badge key={idx} variant="outline">
                    {m.title}: {formatMoney(m.amount, currency)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {proposal.status === "sent" && (
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleAcceptWithWarning}
                disabled={actionLoading === proposal.id}
              >
                {actionLoading === proposal.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {t("proposals.accept")}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => onReject(proposal.id, proposal.freelancer_user_id)}
                disabled={actionLoading === proposal.id}
              >
                <X className="h-4 w-4 mr-1" />
                {t("proposals.reject")}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => onViewProfile(proposal.freelancer_user_id)}
              >
                {t("proposals.viewProfile")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
