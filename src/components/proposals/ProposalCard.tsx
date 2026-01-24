import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, DollarSign, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatMoney";
import { 
  ProposalAIBadge, 
  ProposalAIReasons, 
  getAILevel, 
  getProposalBorderClass 
} from "./ProposalAIBadge";
import type { ProposalRankingData } from "@/hooks/useProposalRankings";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import type { FreelancerTier } from "@/components/freelancer/TierBadge";

interface Freelancer {
  full_name: string | null;
  title: string | null;
  avatar_url: string | null;
  hourly_rate: number | null;
  location: string | null;
  verified: boolean | null;
  tier?: FreelancerTier | null;
}

interface Proposal {
  id: string;
  cover_letter: string | null;
  milestones: unknown;
  status: "sent" | "accepted" | "rejected";
  created_at: string;
  freelancer_user_id: string;
  freelancer?: Freelancer | null;
  is_counterproposal?: boolean;
  counterproposal_justification?: string | null;
  company_response?: string | null;
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
  onRespondToCounterproposal?: (proposal: Proposal) => void;
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
  onRespondToCounterproposal,
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
        <TieredAvatar
          avatarUrl={proposal.freelancer?.avatar_url}
          name={proposal.freelancer?.full_name}
          tier={proposal.freelancer?.tier}
          size="lg"
        />
        
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
            {proposal.is_counterproposal && (
              <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("proposals.counterproposal", "Counter-proposal")}
              </Badge>
            )}
            <Badge 
              variant={proposal.status === "accepted" ? "default" : proposal.status === "rejected" ? "destructive" : "secondary"}
            >
              {proposal.status}
            </Badge>
          </div>

          {/* Counter-proposal company response status */}
          {proposal.is_counterproposal && proposal.company_response && (
            <div className="mb-2">
              <Badge 
                variant="outline"
                className={cn(
                  "text-xs",
                  proposal.company_response === "accepted" && "border-green-500 text-green-600",
                  proposal.company_response === "negotiating" && "border-amber-500 text-amber-600",
                  proposal.company_response === "rejected" && "border-red-500 text-red-600"
                )}
              >
                {proposal.company_response === "accepted" && t("counterproposal.statusAccepted", "Accepted")}
                {proposal.company_response === "negotiating" && t("counterproposal.statusNegotiating", "Negotiating")}
                {proposal.company_response === "rejected" && t("counterproposal.statusRejected", "Rejected")}
              </Badge>
            </div>
          )}

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
            <div className="flex flex-wrap gap-2 mt-3">
              {/* Show respond button for counter-proposals without response */}
              {proposal.is_counterproposal && !proposal.company_response && onRespondToCounterproposal ? (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={() => onRespondToCounterproposal(proposal)}
                  disabled={actionLoading === proposal.id}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {t("counterproposal.respond", "Respond to Counter-proposal")}
                </Button>
              ) : (
                <>
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
                </>
              )}
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
