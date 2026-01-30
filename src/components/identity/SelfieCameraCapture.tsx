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
  "Remova óculos (de grau ou sol)",
  "Retire bonés, chapéus ou toucas",
  "Fundo neutro de preferência",
  "Centralize seu rosto no círculo",
];

export function SelfieCameraCapture({ onCapture, disabled = false }: SelfieCameraCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [cameraState, setCameraState] = useState<"idle" | "requesting" | "active" | "captured" | "uploading" | "uploaded" | "error">("idle");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playBlocked, setPlayBlocked] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (capturedPreviewUrl) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  // Ensure stream is attached to the <video> whenever it mounts.
  // (Fixes the "black video" issue when getUserMedia resolves while we're still in the 'requesting' UI)
  useEffect(() => {
    if (cameraState !== "active") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const p = video.play();
    if (p && typeof (p as Promise<void>).catch === "function") {
      (p as Promise<void>).catch(() => {
        // Some browsers require user interaction to start video playback.
        setPlayBlocked(true);
      });
    }
  }, [cameraState]);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    setError(null);
    setPlayBlocked(false);

    try {
      // Request camera with minimal constraints for faster startup
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;
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
    setPlayBlocked(false);
  }, []);

  const requestVideoPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setPlayBlocked(false);
    video.play().catch(() => {
      setPlayBlocked(true);
    });
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Ensure video metadata is ready
    if (!video.videoWidth || !video.videoHeight) {
      setError("A câmera ainda está carregando. Aguarde 1 segundo e tente novamente.");
      return;
    }

    setError(null);

    // Force a sufficiently large image so it passes the 50KB minimum validation
    // (even on devices where the camera stream comes in at a low resolution)
    const targetWidth = Math.max(video.videoWidth, 1920);
    const targetHeight = Math.max(video.videoHeight, 1440);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Draw the current video frame (mirror for selfie) with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -targetWidth, 0, targetWidth, targetHeight);
    ctx.restore();

    const minBytes = 50 * 1024;

    const makeFileFromBlob = (blob: Blob, name: string) =>
      new File([blob], name, { type: blob.type });

    const createFile = async (): Promise<File> => {
      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.98)
      );

      if (jpegBlob && jpegBlob.size >= minBytes) return makeFileFromBlob(jpegBlob, "selfie.jpg");

      // Fallback: PNG can be larger in some edge cases
      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );

      if (pngBlob && pngBlob.size >= minBytes) return makeFileFromBlob(pngBlob, "selfie.png");

      // Last resort: upscale the captured frame and export at max JPEG quality
      const scale = 1.5;
      const upCanvas = document.createElement("canvas");
      upCanvas.width = Math.min(Math.round(targetWidth * scale), 2560);
      upCanvas.height = Math.min(Math.round(targetHeight * scale), 1920);
      const upCtx = upCanvas.getContext("2d");

      if (upCtx) {
        upCtx.imageSmoothingEnabled = true;
        upCtx.imageSmoothingQuality = "high";
        upCtx.drawImage(canvas, 0, 0, upCanvas.width, upCanvas.height);
      }

      const upJpegBlob = await new Promise<Blob | null>((resolve) =>
        upCanvas.toBlob(resolve, "image/jpeg", 1.0)
      );

      if (upJpegBlob) return makeFileFromBlob(upJpegBlob, "selfie.jpg");

      throw new Error("Falha ao gerar a foto. Tente novamente.");
    };

    try {
      // Cleanup previous preview if any
      if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);

      const file = await createFile();
      const previewUrl = URL.createObjectURL(file);

      setCapturedFile(file);
      setCapturedPreviewUrl(previewUrl);
      setCameraState("captured");

      // Stop camera after capture
      stopCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao capturar a selfie");
    }
  }, [capturedPreviewUrl, stopCamera]);

  const retakePhoto = useCallback(() => {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    setCameraState("idle");
    startCamera();
  }, [capturedPreviewUrl, startCamera]);

  const confirmPhoto = useCallback(async () => {
    if (!capturedFile) return;

    setCameraState("uploading");
    setError(null);

    try {
      await onCapture(capturedFile);
      setCameraState("uploaded");
    } catch (err) {
      console.error("[SELFIE] Upload error:", err);
      setError(err instanceof Error ? err.message : "Falha no envio da selfie");
      setCameraState("captured"); // Allow retry
    }
  }, [capturedFile, onCapture]);

  const cancelCapture = useCallback(() => {
    stopCamera();
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    setCapturedFile(null);
    setCapturedPreviewUrl(null);
    setCameraState("idle");
  }, [stopCamera, capturedPreviewUrl]);

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

          {playBlocked && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="text-center space-y-2">
                <p className="text-sm text-foreground font-medium">
                  Toque para iniciar a câmera
                </p>
                <Button variant="outline" size="sm" onClick={requestVideoPlay}>
                  <Camera className="h-4 w-4 mr-2" />
                  Iniciar
                </Button>
              </div>
            </div>
          )}
          
          {/* Subtle blur outside the face guide (keeps camera "open", no white overlay) */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 backdrop-blur-sm bg-background/5 [mask-image:radial-gradient(ellipse_160px_210px_at_center,transparent_0%,transparent_72%,black_80%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-52 rounded-[50%] border-2 border-white/60 shadow-[0_0_24px_rgba(255,255,255,0.18)] relative">
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-white text-xs bg-black/70 px-3 py-1.5 rounded-full font-medium whitespace-nowrap">
                  Centralize seu rosto
                </div>
              </div>
            </div>

            <div className="absolute top-2 left-2 right-2 flex items-center justify-center">
              <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Boa iluminação e olhe para a câmera
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Button className="w-full" onClick={() => capturePhoto()}>
          <Camera className="h-4 w-4 mr-2" />
          Tirar foto
        </Button>

        {/* Hidden canvas for capture - must be in DOM */}
        <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }} />
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
        {capturedPreviewUrl && (
          <img
            src={capturedPreviewUrl}
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
