import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, MessageCircle, DollarSign } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";

interface Milestone {
  title: string;
  amount: number;
}

interface Proposal {
  id: string;
  milestones: Milestone[] | unknown;
  company_response?: string | null;
  company_feedback?: string | null;
  project_id: string;
}

interface Project {
  title: string;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  company_user_id: string;
}

interface FreelancerCounterproposalResponseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  project: Project;
  onResponseSubmitted: () => void;
}

type ResponseType = "accept" | "counter";

export function FreelancerCounterproposalResponseModal({
  open,
  onOpenChange,
  proposal,
  project,
  onResponseSubmitted,
}: FreelancerCounterproposalResponseModalProps) {
  const { t } = useTranslation();
  const [response, setResponse] = useState<ResponseType | null>(null);
  const [newJustification, setNewJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Calculate current proposed amount
  const milestones = Array.isArray(proposal.milestones)
    ? (proposal.milestones as Milestone[])
    : [];
  const totalProposed = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);

  const handleSubmit = async () => {
    if (!response) {
      toast.error(t("counterproposal.selectResponse", "Please select a response"));
      return;
    }

    if (response === "counter" && newJustification.trim().length < 50) {
      toast.error(t("counterproposal.justificationRequired", "Please provide a detailed justification (at least 50 characters)"));
      return;
    }

    setSubmitting(true);

    try {
      if (response === "accept") {
        // Freelancer accepts the company's counter-proposal feedback
        // Update proposal status and clear the negotiation flag
        const { error } = await supabase
          .from("proposals")
          .update({
            company_response: "accepted",
            counterproposal_justification: newJustification || proposal.company_feedback,
          })
          .eq("id", proposal.id);

        if (error) throw error;

        // Send notification to company
        await supabase.from("notifications").insert({
          user_id: project.company_user_id,
          type: "counterproposal_accepted",
          title: t("notifications.counterproposalAccepted", "Freelancer accepted negotiation"),
          message: t("notifications.counterproposalAcceptedMessage", "The freelancer has accepted your counter-proposal terms for project: {{project}}", { project: project.title }),
          metadata: { proposal_id: proposal.id, project_id: proposal.project_id },
        });

        toast.success(t("counterproposal.acceptedSuccess", "You have accepted the company's terms"));
      } else {
        // Freelancer sends a new counter-argument
        const { error } = await supabase
          .from("proposals")
          .update({
            company_response: null, // Reset to allow company to respond again
            counterproposal_justification: newJustification,
          })
          .eq("id", proposal.id);

        if (error) throw error;

        // Send notification to company
        await supabase.from("notifications").insert({
          user_id: project.company_user_id,
          type: "counterproposal_response",
          title: t("notifications.newCounterArgument", "New counter-argument received"),
          message: t("notifications.newCounterArgumentMessage", "The freelancer has sent a new argument for project: {{project}}", { project: project.title }),
          metadata: { proposal_id: proposal.id, project_id: proposal.project_id },
        });

        toast.success(t("counterproposal.counterSent", "Your response has been sent to the company"));
      }

      onResponseSubmitted();
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting response:", error);
      toast.error(t("common.error", "An error occurred"));
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setResponse(null);
    setNewJustification("");
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) resetState();
        onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("counterproposal.respondToCompany", "Respond to Company")}</DialogTitle>
          <DialogDescription>
            {t("counterproposal.freelancerResponseDesc", "The company has responded to your counter-proposal. Choose how to proceed.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current proposal amount */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-1">{t("counterproposal.yourProposal", "Your proposal")}</p>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-semibold">{formatMoney(totalProposed, project.currency)}</span>
              {project.budget_max && totalProposed > project.budget_max && (
                <Badge variant="outline" className="text-amber-600 border-amber-500">
                  +{formatMoney(totalProposed - project.budget_max, project.currency)} {t("counterproposal.aboveBudget", "above budget")}
                </Badge>
              )}
            </div>
          </div>

          {/* Company feedback */}
          {proposal.company_feedback && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium mb-1 text-blue-800 dark:text-blue-200">
                {t("counterproposal.companyFeedback", "Company feedback")}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{proposal.company_feedback}</p>
            </div>
          )}

          {/* Response options */}
          <div className="space-y-3">
            <Label>{t("counterproposal.yourResponse", "Your response")}</Label>
            <RadioGroup
              value={response || ""}
              onValueChange={(value) => setResponse(value as ResponseType)}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="accept" id="accept" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="accept" className="font-medium cursor-pointer flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    {t("counterproposal.acceptTerms", "Accept company's terms")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("counterproposal.acceptTermsDesc", "Agree to the company's feedback and proceed with the negotiation")}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="counter" id="counter" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="counter" className="font-medium cursor-pointer flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-blue-600" />
                    {t("counterproposal.sendNewArgument", "Send new argument")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("counterproposal.sendNewArgumentDesc", "Provide additional justification for your proposed amount")}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* New justification textarea */}
          {response === "counter" && (
            <div className="space-y-2">
              <Label htmlFor="newJustification">
                {t("counterproposal.newJustification", "Your argument")} *
              </Label>
              <Textarea
                id="newJustification"
                value={newJustification}
                onChange={(e) => setNewJustification(e.target.value)}
                placeholder={t("counterproposal.justificationPlaceholder", "Explain why your proposed amount is justified...")}
                rows={4}
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {newJustification.length < 50 && (
                    <span className="text-destructive">
                      {t("counterproposal.minChars", "Minimum 50 characters")}
                    </span>
                  )}
                </span>
                <span>{newJustification.length}/500</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!response || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("common.send", "Send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
