import { useState, useRef, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, Image, FileText, Video } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FileUploadProps {
  conversationId: string;
  onFileSent: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for videos
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB for docs

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export const FileUploadButton = forwardRef<HTMLDivElement, FileUploadProps>(
  function FileUploadButton({ conversationId, onFileSent, disabled }, ref) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const docInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // Reset input
      e.target.value = '';

      // Upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file size based on type
        const maxSize = type === 'video' ? MAX_FILE_SIZE : (type === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE);
        if (file.size > maxSize) {
          toast.error(t("messages.fileTooLarge"));
          continue;
        }

        // Validate file type
        let allowedTypes: string[];
        if (type === 'image') allowedTypes = ALLOWED_IMAGE_TYPES;
        else if (type === 'video') allowedTypes = ALLOWED_VIDEO_TYPES;
        else allowedTypes = ALLOWED_DOC_TYPES;
        
        if (!allowedTypes.includes(file.type)) {
          toast.error(t("messages.invalidFileType"));
          continue;
        }

        await uploadFile(file, type);
      }
    };

    const uploadFile = async (file: File, type: 'image' | 'video' | 'document') => {
      setUploading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileExt = file.name.split('.').pop();
        const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat_uploads')
          .upload(fileName, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Determine message type
        let messageType: string;
        if (type === 'image') messageType = 'image';
        else if (type === 'video') messageType = 'video';
        else messageType = 'file';

        // Insert message with storage path
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_user_id: user.id,
            content: '',
            type: messageType,
            file_url: fileName,
            file_name: file.name,
            file_mime: file.type,
            file_size: file.size
          });

        if (messageError) throw messageError;

        onFileSent();

      } catch {
        toast.error(t("messages.uploadError"));
      } finally {
        setUploading(false);
      }
    };

    if (uploading) {
      return (
        <div ref={ref}>
          <Button variant="ghost" size="icon" disabled>
            <Loader2 className="h-5 w-5 animate-spin" />
          </Button>
        </div>
      );
    }

    return (
      <div ref={ref}>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={(e) => handleFileSelect(e, 'image')}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
          multiple
          onChange={(e) => handleFileSelect(e, 'video')}
          className="hidden"
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          multiple
          onChange={(e) => handleFileSelect(e, 'document')}
          className="hidden"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              disabled={disabled}
              title={t("messages.attachFile")}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <Image className="h-4 w-4 mr-2" />
              {t("messages.attachImage")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
              <Video className="h-4 w-4 mr-2" />
              {t("messages.attachVideo")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" />
              {t("messages.attachDocument")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);
