import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Loader2, CheckCircle, Clock, CreditCard, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Milestone {
  title: string;
  amount: number;
  description?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: "pending" | "paid" | "released" | "failed";
  stripe_payment_intent_id: string | null;
}

interface MilestonePaymentProps {
  projectId: string;
  projectTitle: string;
  milestones: Milestone[];
  freelancerUserId: string;
  isCompany: boolean;
  payments: Payment[];
  onPaymentComplete: () => void;
}

export default function MilestonePayment({
  projectId,
  projectTitle,
  milestones,
  freelancerUserId,
  isCompany,
  payments,
  onPaymentComplete,
}: MilestonePaymentProps) {
  const { t } = useTranslation();
  const [loadingMilestone, setLoadingMilestone] = useState<number | null>(null);
  const [releasingPayment, setReleasingPayment] = useState<string | null>(null);
  const [confirmReleaseId, setConfirmReleaseId] = useState<string | null>(null);

  const handleFundMilestone = async (milestoneIndex: number, milestone: Milestone) => {
    setLoadingMilestone(milestoneIndex);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          projectId,
          milestoneId: `milestone-${milestoneIndex}`,
          amount: milestone.amount,
          description: `${projectTitle} - ${milestone.title}`,
          freelancerUserId,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success(t("payments.checkoutOpened"));
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(t("payments.checkoutError"));
    } finally {
      setLoadingMilestone(null);
    }
  };

  const handleReleasePayment = async (paymentId: string) => {
    setReleasingPayment(paymentId);
    setConfirmReleaseId(null);

    try {
      const { data, error } = await supabase.functions.invoke("release-payment", {
        body: { paymentId },
      });

      if (error) throw error;

      toast.success(t("payments.released"));
      onPaymentComplete();
    } catch (error) {
      console.error("Release error:", error);
      toast.error(t("payments.releaseError"));
    } finally {
      setReleasingPayment(null);
    }
  };

  const getPaymentForMilestone = (milestoneIndex: number) => {
    // Match payments by approximate amount (within $1)
    const milestone = milestones[milestoneIndex];
    return payments.find(p => 
      Math.abs(Number(p.amount) - milestone.amount) < 1
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("payments.inEscrow")}
          </Badge>
        );
      case "released":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            {t("payments.released")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {t("payments.pending")}
          </Badge>
        );
      default:
        return null;
    }
  };

  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const fundedAmount = payments.filter(p => p.status === "paid" || p.status === "released")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const releasedAmount = payments.filter(p => p.status === "released")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("payments.milestones")}
          </CardTitle>
          <CardDescription>
            {isCompany 
              ? t("payments.milestonesDescCompany")
              : t("payments.milestonesDescFreelancer")
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.totalValue")}</p>
              <p className="text-lg font-bold">${totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.inEscrow")}</p>
              <p className="text-lg font-bold text-yellow-600">${(fundedAmount - releasedAmount).toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payments.released")}</p>
              <p className="text-lg font-bold text-green-600">${releasedAmount.toFixed(2)}</p>
            </div>
          </div>

          {/* Milestones List */}
          <div className="space-y-3">
            {milestones.map((milestone, idx) => {
              const payment = getPaymentForMilestone(idx);
              const isPaid = payment?.status === "paid";
              const isReleased = payment?.status === "released";
              const canFund = isCompany && !payment;
              const canRelease = isCompany && isPaid;

              return (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("payments.milestone")} {idx + 1}
                      </span>
                      {payment && getStatusBadge(payment.status)}
                    </div>
                    <h4 className="font-semibold">{milestone.title}</h4>
                    {milestone.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">${milestone.amount.toFixed(2)}</p>
                    </div>
                    
                    {canFund && (
                      <Button
                        onClick={() => handleFundMilestone(idx, milestone)}
                        disabled={loadingMilestone === idx}
                        className="gap-2"
                      >
                        {loadingMilestone === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <DollarSign className="h-4 w-4" />
                        )}
                        {t("payments.fund")}
                      </Button>
                    )}
                    
                    {canRelease && (
                      <Button
                        onClick={() => setConfirmReleaseId(payment.id)}
                        disabled={releasingPayment === payment.id}
                        variant="default"
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {releasingPayment === payment.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {t("payments.release")}
                      </Button>
                    )}

                    {isReleased && (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Release Confirmation Dialog */}
      <AlertDialog open={!!confirmReleaseId} onOpenChange={() => setConfirmReleaseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("payments.confirmRelease")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("payments.confirmReleaseDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReleaseId && handleReleasePayment(confirmReleaseId)}
              className="bg-green-600 hover:bg-green-700"
            >
              {t("payments.confirmReleaseBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
