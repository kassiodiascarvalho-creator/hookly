import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Shield, Camera, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface IdentityVerificationModalProps {
  open: boolean;
  onClose: () => void;
  subjectType: "freelancer" | "company";
  onVerificationStarted?: () => void;
}

const COUNTRIES = [
  { code: "BR", name: "Brasil", documents: ["cnh", "rg", "passport"] },
  { code: "US", name: "United States", documents: ["passport", "drivers_license", "national_id"] },
  { code: "PT", name: "Portugal", documents: ["passport", "national_id", "drivers_license"] },
  { code: "ES", name: "España", documents: ["passport", "national_id", "drivers_license"] },
  { code: "DE", name: "Deutschland", documents: ["passport", "national_id", "drivers_license"] },
  { code: "FR", name: "France", documents: ["passport", "national_id", "drivers_license"] },
  { code: "UK", name: "United Kingdom", documents: ["passport", "drivers_license"] },
  { code: "OTHER", name: "Outro país / Other", documents: ["passport"] },
];

const DOCUMENT_LABELS: Record<string, string> = {
  cnh: "CNH (Carteira Nacional de Habilitação)",
  rg: "RG (Carteira de Identidade)",
  passport: "Passaporte / Passport",
  national_id: "Documento de Identidade Nacional",
  drivers_license: "Carteira de Motorista",
  residence_permit: "Autorização de Residência",
};

type Step = "select" | "consent" | "verifying" | "success" | "error";

export function IdentityVerificationModal({
  open,
  onClose,
  subjectType,
  onVerificationStarted,
}: IdentityVerificationModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [step, setStep] = useState<Step>("select");
  const [country, setCountry] = useState("BR");
  const [documentType, setDocumentType] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  // Get available documents for selected country
  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const availableDocuments = selectedCountry?.documents || ["passport"];

  // Reset document when country changes
  useEffect(() => {
    if (availableDocuments.length > 0 && !availableDocuments.includes(documentType)) {
      setDocumentType(availableDocuments[0]);
    }
  }, [country, availableDocuments, documentType]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("select");
      setConsentGiven(false);
      setError(null);
      setVerificationUrl(null);
    }
  }, [open]);

  const handleStartVerification = async () => {
    if (!user || !consentGiven) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        throw new Error("Not authenticated");
      }

      const response = await supabase.functions.invoke("create-identity-session", {
        body: {
          country,
          documentType,
          subjectType,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create session");
      }

      const data = response.data;

      if (!data.success) {
        if (data.code === "ALREADY_VERIFIED") {
          toast.info(t("identity.alreadyVerified"));
          onClose();
          return;
        }
        if (data.code === "MAX_ATTEMPTS") {
          setError(t("identity.maxAttemptsReached"));
          setStep("error");
          return;
        }
        throw new Error(data.error || "Unknown error");
      }

      // Open Stripe Identity modal or redirect
      if (data.url) {
        setVerificationUrl(data.url);
        setStep("verifying");
        onVerificationStarted?.();
        
        // Open in new window
        window.open(data.url, "_blank", "width=500,height=700");
      }

    } catch (err: any) {
      console.error("[IDENTITY] Error:", err);
      setError(err.message || t("common.error"));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "select":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
              <Shield className="h-10 w-10 text-primary" />
              <div>
                <h3 className="font-semibold">{t("identity.whyVerify")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("identity.whyVerifyDesc")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("identity.selectCountry")}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("identity.selectDocument")}</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocuments.map((doc) => (
                      <SelectItem key={doc} value={doc}>
                        {DOCUMENT_LABELS[doc] || doc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">{t("identity.whatYouNeed")}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t("identity.needDocument")}</li>
                  <li>{t("identity.needSelfie")}</li>
                  <li>{t("identity.needLighting")}</li>
                </ul>
              </div>
            </div>

            <Button 
              className="w-full" 
              onClick={() => setStep("consent")}
              disabled={!documentType}
            >
              {t("common.continue")}
            </Button>
          </div>
        );

      case "consent":
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-medium">{t("identity.consentTitle")}</h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>{t("identity.consentText1")}</p>
                  <p>{t("identity.consentText2")}</p>
                  <p>{t("identity.consentText3")}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked === true)}
                />
                <label htmlFor="consent" className="text-sm cursor-pointer">
                  {t("identity.consentCheckbox")}
                  <a href="/privacy" target="_blank" className="text-primary hover:underline ml-1">
                    {t("identity.privacyLink")}
                  </a>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("select")} className="flex-1">
                {t("common.back")}
              </Button>
              <Button 
                onClick={handleStartVerification} 
                disabled={!consentGiven || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    {t("identity.startVerification")}
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "verifying":
        return (
          <div className="text-center space-y-6 py-8">
            <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("identity.verifyingTitle")}</h3>
              <p className="text-muted-foreground">{t("identity.verifyingDesc")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("identity.verifyingHint")}
            </p>
            {verificationUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(verificationUrl, "_blank", "width=500,height=700")}
              >
                {t("identity.reopenWindow")}
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              {t("identity.continueInBackground")}
            </Button>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6 py-8">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("identity.successTitle")}</h3>
              <p className="text-muted-foreground">{t("identity.successDesc")}</p>
            </div>
            <Button onClick={onClose}>{t("common.close")}</Button>
          </div>
        );

      case "error":
        return (
          <div className="text-center space-y-6 py-8">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("identity.errorTitle")}</h3>
              <p className="text-muted-foreground">{error || t("common.error")}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={onClose}>
                {t("common.close")}
              </Button>
              <Button onClick={() => setStep("select")}>
                {t("identity.tryAgain")}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("identity.modalTitle")}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && t("identity.modalDesc")}
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

export default IdentityVerificationModal;
