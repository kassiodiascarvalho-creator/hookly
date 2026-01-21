import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Rocket, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformCredits, PLATFORM_ACTIONS } from "@/hooks/usePlatformCredits";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addDays, isAfter } from "date-fns";

interface ProjectBoostButtonProps {
  projectId: string;
  projectStatus: string;
  boostedUntil: string | null;
  onBoostSuccess: () => void;
  variant?: "default" | "compact";
}

export function ProjectBoostButton({
  projectId,
  projectStatus,
  boostedUntil,
  onBoostSuccess,
  variant = "default",
}: ProjectBoostButtonProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { balance, getActionCost, spendCredits, refreshBalance } = usePlatformCredits();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const boostCost = getActionCost(PLATFORM_ACTIONS.BOOST_PROJECT);
  const isBoosted = boostedUntil && isAfter(new Date(boostedUntil), new Date());
  const canBoost = projectStatus === "open" && balance >= boostCost;

  const handleBoost = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Spend credits first
      const { success, error } = await spendCredits(
        PLATFORM_ACTIONS.BOOST_PROJECT,
        `Boost project ${projectId}`
      );

      if (!success) {
        toast.error(error || t("projects.boost.insufficientCredits"));
        setLoading(false);
        return;
      }

      // Calculate new boost end date
      const newBoostedUntil = addDays(new Date(), 7);

      // Update project
      const { error: updateError } = await supabase
        .from("projects")
        .update({ boosted_until: newBoostedUntil.toISOString() })
        .eq("id", projectId);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("project_actions_log").insert({
        project_id: projectId,
        user_id: user.id,
        action: "boost",
        credits_used: boostCost,
        metadata: { boosted_until: newBoostedUntil.toISOString() },
      });

      toast.success(t("projects.boost.success"));
      await refreshBalance();
      onBoostSuccess();
    } catch (err) {
      console.error("[ProjectBoostButton] Error:", err);
      toast.error(t("projects.boost.error"));
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  // Don't show for non-open projects
  if (projectStatus !== "open") return null;

  if (variant === "compact") {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isBoosted ? "secondary" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(true);
                }}
                disabled={!canBoost || loading}
                className={isBoosted ? "border-primary/50 bg-primary/10" : ""}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isBoosted
                ? t("projects.boost.activeUntil", {
                    date: format(new Date(boostedUntil!), "dd/MM/yyyy"),
                  })
                : t("projects.boost.tooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                {t("projects.boost.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("projects.boost.confirmation", { credits: boostCost })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t("projects.boost.cost")}</span>
                <span className="font-semibold">{boostCost} {t("credits")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>{t("projects.boost.duration")}</span>
                <span className="font-semibold">7 {t("common.days")}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t("billing.currentBalance")}</span>
                <span>{balance} {t("credits")}</span>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>
                {t("common.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBoost}
                disabled={loading || !canBoost}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant={isBoosted ? "secondary" : "default"}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirm(true);
        }}
        disabled={!canBoost || loading}
        className={`gap-2 ${isBoosted ? "border-primary/50 bg-primary/10" : ""}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        {isBoosted ? t("projects.boost.extend") : t("projects.boost.cta")}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              {t("projects.boost.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("projects.boost.confirmation", { credits: boostCost })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4 p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t("projects.boost.cost")}</span>
              <span className="font-semibold">{boostCost} {t("credits")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>{t("projects.boost.duration")}</span>
              <span className="font-semibold">7 {t("common.days")}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t("billing.currentBalance")}</span>
              <span>{balance} {t("credits")}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBoost}
              disabled={loading || !canBoost}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
