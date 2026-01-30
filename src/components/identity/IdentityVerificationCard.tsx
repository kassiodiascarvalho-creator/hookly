import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentityVerificationBadge, type IdentityStatus } from "./IdentityVerificationBadge";
import { IdentityVerificationModal } from "./IdentityVerificationModal";
import { Shield, ShieldCheck, Clock, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface IdentityVerificationCardProps {
  subjectType: "freelancer" | "company";
  identityStatus?: IdentityStatus | null;
  identityVerifiedAt?: string | null;
}

export function IdentityVerificationCard({
  subjectType,
  identityStatus: initialStatus,
  identityVerifiedAt,
}: IdentityVerificationCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState<IdentityStatus>(initialStatus || "not_started");
  const [loading, setLoading] = useState(false);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`identity-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "identity_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("[IDENTITY] Realtime update:", payload.new);
          if (payload.new?.status) {
            setStatus(payload.new.status as IdentityStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Sync with prop changes
  useEffect(() => {
    if (initialStatus) {
      setStatus(initialStatus);
    }
  }, [initialStatus]);

  const canStartVerification = ["not_started", "failed_soft"].includes(status);
  const isVerified = status === "verified";
  const isPending = ["pending", "processing"].includes(status);
  const needsManualReview = status === "manual_review";
  const isFailed = ["failed_hard", "rejected"].includes(status);

  const getStatusMessage = () => {
    switch (status) {
      case "verified":
        return {
          icon: ShieldCheck,
          title: t("identity.card.verifiedTitle"),
          description: identityVerifiedAt 
            ? t("identity.card.verifiedAt", { date: format(new Date(identityVerifiedAt), "dd/MM/yyyy") })
            : t("identity.card.verifiedDesc"),
          color: "text-emerald-600",
        };
      case "pending":
      case "processing":
        return {
          icon: Clock,
          title: t("identity.card.pendingTitle"),
          description: t("identity.card.pendingDesc"),
          color: "text-amber-600",
        };
      case "manual_review":
        return {
          icon: AlertCircle,
          title: t("identity.card.reviewTitle"),
          description: t("identity.card.reviewDesc"),
          color: "text-yellow-600",
        };
      case "failed_soft":
        return {
          icon: AlertCircle,
          title: t("identity.card.failedSoftTitle"),
          description: t("identity.card.failedSoftDesc"),
          color: "text-orange-600",
        };
      case "failed_hard":
      case "rejected":
        return {
          icon: AlertCircle,
          title: t("identity.card.rejectedTitle"),
          description: t("identity.card.rejectedDesc"),
          color: "text-red-600",
        };
      default:
        return {
          icon: Shield,
          title: t("identity.card.notStartedTitle"),
          description: t("identity.card.notStartedDesc"),
          color: "text-muted-foreground",
        };
    }
  };

  const statusInfo = getStatusMessage();
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <Card className={isVerified ? "border-emerald-200 bg-emerald-50/30" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
              {statusInfo.title}
            </span>
            <IdentityVerificationBadge status={status} size="sm" />
          </CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {canStartVerification && (
            <Button 
              onClick={() => setModalOpen(true)} 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("common.loading")}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {status === "failed_soft" 
                    ? t("identity.tryAgain") 
                    : t("identity.verifyIdentity")}
                </>
              )}
            </Button>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("identity.checkingStatus")}
            </div>
          )}

          {needsManualReview && (
            <p className="text-sm text-yellow-600">
              {t("identity.manualReviewInfo")}
            </p>
          )}

          {isFailed && (
            <p className="text-sm text-red-600">
              {t("identity.contactSupport")}
            </p>
          )}
        </CardContent>
      </Card>

      <IdentityVerificationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        subjectType={subjectType}
        onVerificationStarted={() => {
          setStatus("pending");
        }}
      />
    </>
  );
}

export default IdentityVerificationCard;
