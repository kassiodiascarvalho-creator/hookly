import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { IdentityVerificationBadge } from "./IdentityVerificationBadge";
import { IdentityVerificationModal } from "./IdentityVerificationModal";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

interface IdentityVerificationCardProps {
  subjectType: "freelancer" | "company";
}

export function IdentityVerificationCard({ subjectType }: IdentityVerificationCardProps) {
  const { t, i18n } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const {
    status,
    canStartVerification,
    verifiedAt,
    failureReason,
    isLoading,
    refetch,
  } = useIdentityVerification({ subjectType });

  const dateLocale = i18n.language.startsWith("pt") ? ptBR : enUS;

  const getStatusMessage = () => {
    switch (status) {
      case "verified":
        return verifiedAt
          ? t("identity.verifiedAt", { date: format(new Date(verifiedAt), "PP", { locale: dateLocale }) })
          : t("identity.verified");
      case "pending":
        return t("identity.pendingMessage");
      case "processing":
        return t("identity.processingMessage");
      case "manual_review":
        return t("identity.manualReviewMessage");
      case "failed_soft":
        return failureReason || t("identity.failedSoftMessage");
      case "rejected":
        return t("identity.rejectedMessage");
      default:
        return t("identity.notStartedMessage");
    }
  };

  // Can only start if not_started, or retry if rejected/failed_soft
  const canRetry = canStartVerification && ["not_started", "failed_soft", "rejected"].includes(status);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t("identity.cardTitle")}</CardTitle>
            </div>
            <IdentityVerificationBadge status={status} size="md" />
          </div>
          <CardDescription>{t("identity.cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>

              <div className="flex gap-2">
                {canRetry && (
                  <Button onClick={() => setModalOpen(true)} className="flex-1">
                    {status === "not_started" ? (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        {t("identity.startVerification")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t("identity.tryAgain")}
                      </>
                    )}
                  </Button>
                )}

                {status === "verified" && (
                  <Button variant="outline" className="flex-1" disabled>
                    <Shield className="h-4 w-4 mr-2" />
                    {t("identity.verified")}
                  </Button>
                )}

                {["pending", "processing", "manual_review"].includes(status) && (
                  <Button variant="outline" className="flex-1" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("identity.checkStatus")}
                  </Button>
                )}
              </div>

              {status === "rejected" && (
                <Button variant="link" className="p-0 h-auto text-sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {t("identity.contactSupport")}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <IdentityVerificationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        subjectType={subjectType}
        onVerificationStarted={refetch}
      />
    </>
  );
}

export default IdentityVerificationCard;
