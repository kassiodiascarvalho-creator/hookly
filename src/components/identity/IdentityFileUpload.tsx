import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, Check, AlertCircle, Camera, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadState {
  file: File | null;
  preview: string | null;
  isUploading: boolean;
  isUploaded: boolean;
  error: string | null;
}

interface IdentityFileUploadProps {
  fileType: "document_front" | "document_back" | "selfie";
  label: string;
  description?: string;
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

const FILE_TYPE_ICONS = {
  document_front: FileText,
  document_back: FileText,
  selfie: Camera,
};

const QUALITY_TIPS = {
  document_front: [
    "Posicione o documento em uma superfície plana",
    "Evite reflexos e sombras",
    "Certifique-se que todos os dados estão legíveis",
  ],
  document_back: [
    "Vire o documento para o verso",
    "Mantenha as mesmas condições de iluminação",
  ],
  selfie: [
    "Olhe diretamente para a câmera",
    "Mantenha o rosto bem iluminado",
    "Remova óculos de sol ou chapéus",
    "Fundo neutro de preferência",
  ],
};

export function IdentityFileUpload({
  fileType,
  label,
  description,
  onUpload,
  disabled = false,
}: IdentityFileUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FileUploadState>({
    file: null,
    preview: null,
    isUploading: false,
    isUploaded: false,
    error: null,
  });

  const Icon = FILE_TYPE_ICONS[fileType];
  const tips = QUALITY_TIPS[fileType];

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setState(prev => ({ ...prev, error: "Arquivo muito grande. Máximo 10MB." }));
        return;
      }

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setState(prev => ({ ...prev, error: "Formato inválido. Use JPG, PNG ou WebP." }));
        return;
      }

      // Create preview
      const preview = URL.createObjectURL(file);
      setState({
        file,
        preview,
        isUploading: true,
        isUploaded: false,
        error: null,
      });

      try {
        await onUpload(file);
        setState(prev => ({ ...prev, isUploading: false, isUploaded: true }));
      } catch (err) {
        setState(prev => ({
          ...prev,
          isUploading: false,
          error: err instanceof Error ? err.message : "Falha no upload",
        }));
      }
    },
    [onUpload]
  );

  const handleRemove = useCallback(() => {
    if (state.preview) {
      URL.revokeObjectURL(state.preview);
    }
    setState({
      file: null,
      preview: null,
      isUploading: false,
      isUploaded: false,
      error: null,
    });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [state.preview]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{label}</span>
          {state.isUploaded && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </div>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>

      {!state.preview ? (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer",
            "hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed",
            state.error && "border-destructive"
          )}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled}
          />

          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              <span className="text-primary font-medium">Clique para enviar</span>
              <span className="text-muted-foreground"> ou arraste</span>
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG ou WebP (máx. 10MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-lg overflow-hidden bg-muted">
          <img
            src={state.preview}
            alt={label}
            className="w-full h-48 object-cover"
          />
          
          {state.isUploading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {state.isUploaded && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
              <Check className="h-4 w-4" />
            </div>
          )}

          {!state.isUploading && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 left-2 h-8 w-8"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {state.error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {state.error}
        </div>
      )}

      {/* Quality tips */}
      {!state.preview && tips && (
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Dicas de qualidade:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
