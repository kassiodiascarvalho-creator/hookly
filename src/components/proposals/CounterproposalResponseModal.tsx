import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Check, 
  X, 
  MessageSquare, 
  AlertTriangle,
  DollarSign,
  Loader2
} from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Milestone {
  title: string;
  amount: number;
}

interface Freelancer {
  full_name: string | null;
  avatar_url: string | null;
  title: string | null;
}

interface Proposal {
  id: string;
  milestones: Milestone[] | unknown;
  counterproposal_justification?: string | null;
  freelancer_user_id: string;
  freelancer?: Freelancer | null;
}

interface Project {
  id: string;
  budget_min: number | null;
  budget_ideal: number | null;
  budget_max: number | null;
  currency: string;
}

interface CounterproposalResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  project: Project;
  companyUserId: string;
  onResponseSubmitted: () => void;
}

type ResponseType = "accepted" | "negotiating" | "rejected";

export function CounterproposalResponseModal({
  open,
  onOpenChange,
  proposal,
  project,
  companyUserId,
  onResponseSubmitted,
}: CounterproposalResponseModalProps) {
  const { t } = useTranslation();
  const [responseType, setResponseType] = useState<ResponseType | null>(null);
  const [feedback, setFeedback] = useState("");
  const [suggestedAmount, setSuggestedAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const milestones = Array.isArray(proposal.milestones) 
    ? proposal.milestones as Milestone[]
    : [];
  
  const totalProposed = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
  const excessAmount = project.budget_max 
    ? totalProposed - project.budget_max 
    : 0;
  const excessPercent = project.budget_max 
    ? Math.round((excessAmount / project.budget_max) * 100) 
    : 0;

  const handleSubmit = async () => {
    if (!responseType) {
      toast.error(t("counterproposal.selectResponse", "Please select a response option"));
      return;
    }

    if (responseType === "rejected" && !feedback.trim()) {
      toast.error(t("counterproposal.feedbackRequired", "Please provide feedback for rejection"));
      return;
    }

    if (responseType === "negotiating" && !feedback.trim()) {
      toast.error(t("counterproposal.negotiationFeedbackRequired", "Please explain your negotiation terms"));
      return;
    }

    setLoading(true);

    try {
      // If accepted, use centralized RPC to finalize
      if (responseType === "accepted") {
        const { error: rpcError } = await supabase.rpc("finalize_proposal_acceptance", {
          p_proposal_id: proposal.id,
        });

        if (rpcError) throw rpcError;

        // Create or get conversation
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("company_user_id", companyUserId)
          .eq("freelancer_user_id", proposal.freelancer_user_id)
          .maybeSingle();

        if (!existingConv) {
          await supabase.from("conversations").insert({
            company_user_id: companyUserId,
            freelancer_user_id: proposal.freelancer_user_id,
          });
        }
      } else {
        // For negotiating or rejected, just update proposal fields
        const updateData: Record<string, unknown> = {
          company_response: responseType,
          company_response_at: new Date().toISOString(),
          company_feedback: feedback.trim() || null,
        };

        const { error } = await supabase
          .from("proposals")
          .update(updateData)
          .eq("id", proposal.id);

        if (error) throw error;
      }

      // Create notification for freelancer
      const notificationMessages = {
        accepted: t("counterproposal.notificationAccepted", "Your counter-proposal was accepted!"),
        negotiating: t("counterproposal.notificationNegotiating", "The company wants to negotiate your counter-proposal"),
        rejected: t("counterproposal.notificationRejected", "Your counter-proposal was not accepted"),
      };

      await supabase.from("notifications").insert({
        user_id: proposal.freelancer_user_id,
        type: "counterproposal_response",
        message: notificationMessages[responseType],
        link: `/my-proposals`,
      });

      toast.success(t("counterproposal.responseSent", "Response sent successfully"));
      onResponseSubmitted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting response:", error);
      toast.error(t("common.error", "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  const responseOptions = [
    {
      value: "accepted" as ResponseType,
      icon: Check,
      title: t("counterproposal.accept", "Accept Counter-proposal"),
      description: t("counterproposal.acceptDesc", "Accept the proposed amount and proceed to contract"),
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
    },
    {
      value: "negotiating" as ResponseType,
      icon: MessageSquare,
      title: t("counterproposal.negotiate", "Request Adjustment"),
      description: t("counterproposal.negotiateDesc", "Propose a different amount or terms"),
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
    },
    {
      value: "rejected" as ResponseType,
      icon: X,
      title: t("counterproposal.reject", "Reject Counter-proposal"),
      description: t("counterproposal.rejectDesc", "Decline this proposal with feedback"),
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t("counterproposal.title", "Counter-proposal Response")}
          </DialogTitle>
          <DialogDescription>
            {t("counterproposal.subtitle", "This proposal exceeds your budget. Choose how to respond.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Freelancer Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={proposal.freelancer?.avatar_url || undefined} />
              <AvatarFallback>
                {proposal.freelancer?.full_name?.charAt(0) || "F"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{proposal.freelancer?.full_name || "Freelancer"}</p>
              <p className="text-sm text-muted-foreground">{proposal.freelancer?.title}</p>
            </div>
          </div>

          {/* Budget Comparison */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">{t("counterproposal.budgetComparison", "Budget Comparison")}</h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground">{t("counterproposal.yourBudget", "Your Budget (Max)")}</p>
                <p className="font-semibold text-lg">
                  {formatMoney(project.budget_max || 0, project.currency)}
                </p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-muted-foreground">{t("counterproposal.proposedAmount", "Proposed Amount")}</p>
                <p className="font-semibold text-lg text-amber-600">
                  {formatMoney(totalProposed, project.currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-950/30 rounded text-sm text-amber-700 dark:text-amber-400">
              <DollarSign className="h-4 w-4" />
              <span>
                {t("counterproposal.exceeds", "Exceeds by {{amount}} ({{percent}}%)", {
                  amount: formatMoney(excessAmount, project.currency),
                  percent: excessPercent,
                })}
              </span>
            </div>
          </div>

          {/* Freelancer Justification */}
          {proposal.counterproposal_justification && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{t("counterproposal.freelancerJustification", "Freelancer's Justification")}</h4>
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="italic">"{proposal.counterproposal_justification}"</p>
              </div>
            </div>
          )}

          {/* Response Options */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">{t("counterproposal.yourResponse", "Your Response")}</h4>
            
            <RadioGroup
              value={responseType || ""}
              onValueChange={(val) => setResponseType(val as ResponseType)}
              className="space-y-3"
            >
              {responseOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = responseType === option.value;
                
                return (
                  <div
                    key={option.value}
                    className={`relative flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      isSelected ? option.bgColor : "hover:bg-muted/50"
                    }`}
                    onClick={() => setResponseType(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${option.color}`} />
                        <Label htmlFor={option.value} className="font-medium cursor-pointer">
                          {option.title}
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Feedback/Negotiation Terms */}
          {(responseType === "negotiating" || responseType === "rejected") && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="feedback">
                {responseType === "negotiating" 
                  ? t("counterproposal.negotiationTerms", "Your Negotiation Terms *")
                  : t("counterproposal.rejectionFeedback", "Rejection Feedback *")
                }
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  responseType === "negotiating"
                    ? t("counterproposal.negotiationPlaceholder", "Explain your preferred terms, suggest a different amount, or propose scope changes...")
                    : t("counterproposal.rejectionPlaceholder", "Explain why this counter-proposal doesn't work for your project...")
                }
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {responseType === "negotiating"
                  ? t("counterproposal.negotiationHint", "Be specific about what changes you'd accept")
                  : t("counterproposal.rejectionHint", "Constructive feedback helps freelancers improve future proposals")
                }
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !responseType}
              className="flex-1"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("counterproposal.sendResponse", "Send Response")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
