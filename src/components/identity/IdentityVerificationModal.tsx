import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, Shield, CheckCircle2, AlertCircle, 
  ChevronRight, ChevronLeft, Upload, AlertTriangle
} from "lucide-react";
import { IdentityFileUpload } from "./IdentityFileUpload";
import { SelfieCameraCapture } from "./SelfieCameraCapture";
import { useIdentityVerification } from "@/hooks/useIdentityVerification";
import { Progress } from "@/components/ui/progress";

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

// Documents that don't have a back side
const NO_BACK_DOCUMENTS = ["passport"];

type Step = "select" | "consent" | "upload" | "processing" | "success" | "error";

export function IdentityVerificationModal({
  open,
  onClose,
  subjectType,
  onVerificationStarted,
}: IdentityVerificationModalProps) {
  const { t } = useTranslation();
  const { 
    startVerification, 
    uploadFile, 
    finalizeUploads, 
    refetch,
    attempts,
    maxAttempts,
    failureReason: existingFailureReason,
  } = useIdentityVerification({
    subjectType,
  });
  
  const [step, setStep] = useState<Step>("select");
  const [country, setCountry] = useState("BR");
  const [documentType, setDocumentType] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  
  // Upload state
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [uploadPrefix, setUploadPrefix] = useState<string | null>(null);
  const [requiredFiles, setRequiredFiles] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());

  // Get available documents for selected country
  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const availableDocuments = selectedCountry?.documents || ["passport"];
  const hasBackSide = !NO_BACK_DOCUMENTS.includes(documentType);

  // Attempts info
  const isLastAttempt = attempts >= maxAttempts - 1;
  const remainingAttempts = maxAttempts - attempts;

  // Reset document when country changes
  const handleCountryChange = (value: string) => {
    setCountry(value);
    const newCountry = COUNTRIES.find(c => c.code === value);
    if (newCountry && !newCountry.documents.includes(documentType)) {
      setDocumentType(newCountry.documents[0]);
    }
  };

  // Reset state when modal opens
  const resetState = useCallback(() => {
    setStep("select");
    setConsentGiven(false);
    setError(null);
    setFailureReason(null);
    setVerificationId(null);
    setUploadPrefix(null);
    setRequiredFiles([]);
    setUploadedFiles(new Set());
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleStartSession = async () => {
    if (!consentGiven) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await startVerification({
        country,
        documentType,
        hasBackSide,
      });

      setVerificationId(result.verificationId);
      setUploadPrefix(result.uploadPrefix);
      setRequiredFiles(result.requiredFiles);
      setStep("upload");
      onVerificationStarted?.();
    } catch (err) {
      console.error("[IDENTITY] Error:", err);
      setError(err instanceof Error ? err.message : t("common.error"));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (fileType: string, file: File) => {
    if (!verificationId || !uploadPrefix) return;

    await uploadFile({
      verificationId,
      uploadPrefix,
      fileType: fileType as "document_front" | "document_back" | "selfie",
      file,
    });

    setUploadedFiles(prev => new Set([...prev, fileType]));
  };

  const handleFinalize = async () => {
    if (!verificationId) return;

    setLoading(true);
    setError(null);
    setFailureReason(null);

    try {
      const result = await finalizeUploads(verificationId);
      
      if (result.status === "failed_soft") {
        // Show failure reason and allow retry
        setFailureReason(result.failureReason || "Problema com as imagens enviadas");
        setError(result.failureReason || "Houve um problema com as imagens. Por favor, tente novamente.");
        // Stay on upload step to allow retry
        setUploadedFiles(new Set());
        toast.error("Problema nas imagens", {
          description: result.failureReason || "Por favor, envie fotos mais nítidas.",
        });
      } else {
        setStep("processing");
        toast.success("Documentos enviados!", {
          description: "Você será notificado quando a análise for concluída.",
        });
        
        // Wait a bit and close
        setTimeout(() => {
          handleClose();
          refetch();
        }, 3000);
      }
    } catch (err) {
      console.error("[IDENTITY] Finalize error:", err);
      setError(err instanceof Error ? err.message : t("common.error"));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const canFinalize = requiredFiles.every(f => uploadedFiles.has(f));
  const uploadProgress = requiredFiles.length > 0 
    ? (uploadedFiles.size / requiredFiles.length) * 100 
    : 0;

  const renderStep = () => {
    switch (step) {
      case "select":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg">
              <Shield className="h-10 w-10 text-primary shrink-0" />
              <div>
                <h3 className="font-semibold">{t("identity.whyVerify")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("identity.whyVerifyDesc")}
                </p>
              </div>
            </div>

            {/* Show existing failure reason if retrying */}
            {existingFailureReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Último erro:</strong> {existingFailureReason}
                </AlertDescription>
              </Alert>
            )}

            {/* Attempts counter */}
            {attempts > 0 && (
              <Alert variant={isLastAttempt ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isLastAttempt ? (
                    <strong>⚠️ Esta é sua última tentativa!</strong>
                  ) : (
                    <>Tentativa {attempts + 1} de {maxAttempts} ({remainingAttempts} restantes)</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("identity.selectCountry")}</Label>
                <Select value={country} onValueChange={handleCountryChange}>
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
                    <SelectValue placeholder="Selecione o documento" />
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

            <Button 
              className="w-full" 
              onClick={() => setStep("consent")}
              disabled={!documentType}
            >
              {t("common.continue")}
              <ChevronRight className="ml-2 h-4 w-4" />
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
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Button>
              <Button 
                onClick={handleStartSession} 
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
                    <Upload className="h-4 w-4 mr-2" />
                    {t("identity.startUpload")}
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "upload":
        return (
          <div className="space-y-6">
            {/* Error alert for failed_soft */}
            {failureReason && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Problema detectado:</strong> {failureReason}
                  <br />
                  <span className="text-sm">Por favor, envie novas fotos corrigindo os problemas acima.</span>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progresso do envio</span>
                <span className="text-muted-foreground">
                  {uploadedFiles.size}/{requiredFiles.length} arquivos
                </span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>

            <div className="space-y-4">
              <IdentityFileUpload
                fileType="document_front"
                label="Documento (Frente)"
                description={DOCUMENT_LABELS[documentType]}
                onUpload={(file) => handleFileUpload("document_front", file)}
              />

              {hasBackSide && (
                <IdentityFileUpload
                  fileType="document_back"
                  label="Documento (Verso)"
                  onUpload={(file) => handleFileUpload("document_back", file)}
                />
              )}

              <SelfieCameraCapture
                onCapture={(file) => handleFileUpload("selfie", file)}
              />
            </div>

            {/* Attempts warning */}
            {isLastAttempt && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Esta é sua última tentativa. Certifique-se de enviar fotos nítidas e legíveis.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("consent")} className="flex-1">
                <ChevronLeft className="mr-2 h-4 w-4" />
                {t("common.back")}
              </Button>
              <Button 
                onClick={handleFinalize} 
                disabled={!canFinalize || loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Enviar para análise
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case "processing":
        return (
          <div className="text-center space-y-6 py-8">
            <div className="relative">
              <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
              <CheckCircle2 className="h-6 w-6 absolute bottom-0 right-1/2 translate-x-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Documentos enviados!</h3>
              <p className="text-muted-foreground">
                Sua verificação está em análise. Você receberá uma notificação quando concluirmos.
              </p>
            </div>
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          </div>
        );

      case "success":
        return (
          <div className="text-center space-y-6 py-8">
            <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold mb-2">{t("identity.successTitle")}</h3>
              <p className="text-muted-foreground">{t("identity.successDesc")}</p>
            </div>
            <Button onClick={handleClose}>{t("common.close")}</Button>
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
              <Button variant="outline" onClick={handleClose}>
                {t("common.close")}
              </Button>
              <Button onClick={() => {
                resetState();
                setStep("select");
              }}>
                {t("identity.tryAgain")}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t("identity.modalTitle")}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && t("identity.modalDesc")}
            {step === "upload" && "Envie as fotos do seu documento e uma selfie"}
          </DialogDescription>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

export default IdentityVerificationModal;
