import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Camera, RefreshCw, Check, AlertCircle, Loader2, X, Lightbulb, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelfieCameraCaptureProps {
  onCapture: (file: File) => Promise<void>;
  disabled?: boolean;
}

const QUALITY_TIPS = [
  "Olhe diretamente para a câmera",
  "Mantenha o rosto bem iluminado",
  "Remova óculos de sol ou chapéus",
  "Fundo neutro de preferência",
  "Centralize seu rosto no círculo",
];

export function SelfieCameraCapture({ onCapture, disabled = false }: SelfieCameraCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "active" | "captured" | "uploading" | "uploaded" | "error">("idle");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [capturedImage]);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setError(null);

    try {
      // Request camera with front-facing preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState("active");
    } catch (err) {
      console.error("[SELFIE] Camera error:", err);
      let message = "Não foi possível acessar a câmera.";
      
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          message = "Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do seu navegador.";
        } else if (err.name === "NotFoundError") {
          message = "Nenhuma câmera encontrada no dispositivo.";
        } else if (err.name === "NotReadableError") {
          message = "A câmera está sendo usada por outro aplicativo.";
        }
      }
      
      setError(message);
      setCameraState("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame (mirror for selfie)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    setCameraState("captured");

    // Stop camera after capture
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCameraState("idle");
    startCamera();
  }, [capturedImage, startCamera]);

  const confirmPhoto = useCallback(async () => {
    if (!capturedImage) return;

    setCameraState("uploading");
    setError(null);

    try {
      // Convert data URL to File
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });

      await onCapture(file);
      setCameraState("uploaded");
    } catch (err) {
      console.error("[SELFIE] Upload error:", err);
      setError(err instanceof Error ? err.message : "Falha no envio da selfie");
      setCameraState("captured"); // Allow retry
    }
  }, [capturedImage, onCapture]);

  const cancelCapture = useCallback(() => {
    stopCamera();
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setCameraState("idle");
  }, [stopCamera, capturedImage]);

  // Render idle state - start button
  if (cameraState === "idle") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Selfie</span>
          </div>
          <span className="text-xs text-muted-foreground">Foto em tempo real</span>
        </div>

        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
            "hover:border-primary/50 hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !disabled && startCamera()}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-sm">
              <span className="text-primary font-medium">Clique para abrir a câmera</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Tire uma selfie para verificação de identidade
            </p>
          </div>
        </div>

        {/* Quality tips */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 font-medium mb-1">
            <Lightbulb className="h-3 w-3" />
            Dicas de qualidade:
          </div>
          <ul className="list-disc list-inside space-y-0.5">
            {QUALITY_TIPS.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Render requesting permission state
  if (cameraState === "requesting") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Selfie</span>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-muted h-64 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Acessando câmera...</p>
            <p className="text-xs text-muted-foreground mt-1">
              Por favor, permita o acesso à câmera
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (cameraState === "error") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Selfie</span>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-destructive/10 border border-destructive/20 h-64 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive font-medium mb-1">Erro ao acessar câmera</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" size="sm" onClick={startCamera}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render active camera view
  if (cameraState === "active") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <span className="font-medium">Selfie</span>
          </div>
          <Button variant="ghost" size="sm" onClick={cancelCapture}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black">
          {/* Video element - mirrored for selfie */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover scale-x-[-1]"
          />
          
          {/* Face guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-52 border-2 border-white/50 rounded-[50%] relative">
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                Centralize seu rosto
              </div>
            </div>
          </div>

          {/* Tips overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-center">
            <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Boa iluminação e olhe para a câmera
            </div>
          </div>
        </div>

        <Button className="w-full" onClick={capturePhoto}>
          <Camera className="h-4 w-4 mr-2" />
          Tirar foto
        </Button>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Render captured/uploading/uploaded states
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Selfie</span>
          {cameraState === "uploaded" && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden bg-muted">
        {capturedImage && (
          <img
            src={capturedImage}
            alt="Selfie capturada"
            className="w-full h-64 object-cover"
          />
        )}

        {cameraState === "uploading" && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {cameraState === "uploaded" && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {cameraState === "captured" && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={retakePhoto}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tirar outra
          </Button>
          <Button className="flex-1" onClick={confirmPhoto}>
            <Check className="h-4 w-4 mr-2" />
            Usar esta foto
          </Button>
        </div>
      )}

      {cameraState === "uploaded" && (
        <Button variant="outline" className="w-full" onClick={retakePhoto}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tirar outra foto
        </Button>
      )}
    </div>
  );
}
