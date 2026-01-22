import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, MessageCircle, DollarSign, ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";

interface Milestone {
  title: string;
  amount: number;
  description?: string;
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
  const [newProposedAmount, setNewProposedAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Calculate current proposed amount
  const milestones = Array.isArray(proposal.milestones)
    ? (proposal.milestones as Milestone[])
    : [];
  const totalProposed = milestones.reduce((sum, m) => sum + (m.amount || 0), 0);

  // Initialize new proposed amount when modal opens
  useEffect(() => {
    if (open) {
      setNewProposedAmount(totalProposed.toString());
    }
  }, [open, totalProposed]);

  const handleSubmit = async () => {
    if (!response) {
      toast.error(t("counterproposal.selectResponse", "Please select a response"));
      return;
    }

    if (response === "counter") {
      if (newJustification.trim().length < 50) {
        toast.error(t("counterproposal.justificationRequired", "Please provide a detailed justification (at least 50 characters)"));
        return;
      }
      
      const proposedValue = parseFloat(newProposedAmount);
      if (isNaN(proposedValue) || proposedValue <= 0) {
        toast.error(t("counterproposal.invalidAmount", "Please enter a valid amount"));
        return;
      }
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
        // Freelancer sends a new counter-argument with new proposed amount
        const proposedValue = parseFloat(newProposedAmount);
        
        // Update milestones with the new proposed amount
        // Keep the same milestone structure but update the amount proportionally
        const updatedMilestones = milestones.length > 0
          ? milestones.map((m, index) => {
              if (milestones.length === 1) {
                return { ...m, amount: proposedValue };
              }
              // Distribute proportionally for multiple milestones
              const proportion = m.amount / totalProposed;
              return { ...m, amount: Math.round(proposedValue * proportion) };
            })
          : [{ title: "Milestone 1", amount: proposedValue }];

        const { error } = await supabase
          .from("proposals")
          .update({
            company_response: null, // Reset to allow company to respond again
            counterproposal_justification: newJustification,
            milestones: updatedMilestones,
          })
          .eq("id", proposal.id);

        if (error) throw error;

        // Send notification to company with the new proposed value
        await supabase.from("notifications").insert({
          user_id: project.company_user_id,
          type: "counterproposal_response",
          title: t("notifications.newCounterArgument", "New counter-argument received"),
          message: t("notifications.newCounterArgumentMessage", "The freelancer has proposed {{amount}} for project: {{project}}", { 
            amount: formatMoney(proposedValue, project.currency),
            project: project.title 
          }),
          metadata: { 
            proposal_id: proposal.id, 
            project_id: proposal.project_id,
            proposed_amount: proposedValue,
          },
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
    setNewProposedAmount(totalProposed.toString());
  };

  const parsedNewAmount = parseFloat(newProposedAmount) || 0;
  const amountDifference = parsedNewAmount - totalProposed;

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
                    {t("counterproposal.sendNewArgumentDesc", "Propose a new amount with justification")}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* New proposed amount and justification */}
          {response === "counter" && (
            <div className="space-y-4">
              {/* New proposed amount */}
              <div className="space-y-2">
                <Label htmlFor="newAmount">
                  {t("counterproposal.newProposedAmount", "New proposed amount")} *
                </Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="newAmount"
                      type="number"
                      value={newProposedAmount}
                      onChange={(e) => setNewProposedAmount(e.target.value)}
                      className="pl-9"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{project.currency}</span>
                </div>
                
                {/* Show difference from original */}
                {amountDifference !== 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{formatMoney(totalProposed, project.currency)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatMoney(parsedNewAmount, project.currency)}</span>
                    <Badge 
                      variant="outline" 
                      className={amountDifference > 0 
                        ? "text-amber-600 border-amber-500" 
                        : "text-green-600 border-green-500"
                      }
                    >
                      {amountDifference > 0 ? "+" : ""}{formatMoney(amountDifference, project.currency)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Justification */}
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
