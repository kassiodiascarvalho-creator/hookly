import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, RefreshCw, ExternalLink, Loader2, Mail, MessageCircle } from "lucide-react";
import { IdentityVerificationBadge } from "./IdentityVerificationBadge";
import { IdentityVerificationModal } from "./IdentityVerificationModal";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    attempts,
    maxAttempts,
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
      case "uploading":
        // Uploading is treated as not started visually - user hasn't submitted yet
        return t("identity.notStartedMessage");
      default:
        return t("identity.notStartedMessage");
    }
  };

  // Check if max attempts reached
  const maxAttemptsReached = attempts >= maxAttempts;
  
  // Can only start if not_started, uploading (incomplete upload), or retry if rejected/failed_soft AND not reached max attempts
  const canRetry = canStartVerification && !maxAttemptsReached && ["not_started", "uploading", "failed_soft", "rejected"].includes(status);

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

              {/* Show contact options when max attempts reached */}
              {maxAttemptsReached && status !== "verified" && (
                <Alert className="border-warning/50 bg-warning/10">
                  <AlertDescription className="space-y-3">
                    <p className="font-medium text-foreground">
                      Você atingiu o limite de tentativas de verificação.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato conosco para resolver sua situação:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open("mailto:suporte@hookly.com?subject=Verificação de Identidade", "_blank")}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        E-mail
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open("https://wa.me/5511999999999?text=Olá, preciso de ajuda com minha verificação de identidade", "_blank")}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                {canRetry && (
                  <Button onClick={() => setModalOpen(true)} className="flex-1">
                    {status === "not_started" || status === "uploading" ? (
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
