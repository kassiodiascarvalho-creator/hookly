import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Loader2, X, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  bucket: "avatars" | "logos" | "attachments" | "portfolio";
  onUploadComplete: (url: string) => void;
  currentUrl?: string | null;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

export function FileUpload({
  bucket,
  onUploadComplete,
  currentUrl,
  accept = "image/*",
  maxSizeMB = 5,
  className
}: FileUploadProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(t("uploads.fileTooLarge", { size: maxSizeMB }));
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(t("uploads.invalidFileType"));
      return;
    }

    setUploading(true);

    try {
      // Create file path with user ID folder
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setPreview(publicUrl);
      onUploadComplete(publicUrl);
      toast.success(t("uploads.success"));
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("uploads.error"));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUploadComplete("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {preview ? (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="h-24 w-24 rounded-lg object-cover border"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <Image className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {t("uploads.selectFile")}
      </Button>
    </div>
  );
}
