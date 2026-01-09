import { useState, useRef } from "react";
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

export function FileUploadButton({ conversationId, onFileSent, disabled }: FileUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Copy files to array BEFORE resetting input (FileList is a live reference)
    const files = Array.from(fileList);
    
    // Reset input after copying
    e.target.value = '';
    
    console.log('[FileUpload] fileSelected:', files.length, 'files, type:', type);

    // Process all files
    for (const file of files) {
      // Validate file size based on type
      const maxSize = type === 'video' ? MAX_FILE_SIZE : (type === 'image' ? MAX_IMAGE_SIZE : MAX_DOC_SIZE);
      if (file.size > maxSize) {
        toast.error(t("messages.fileTooLarge"));
        console.error('[FileUpload] File too large:', file.name, file.size);
        continue;
      }

      // Validate file type
      let allowedTypes: string[];
      if (type === 'image') allowedTypes = ALLOWED_IMAGE_TYPES;
      else if (type === 'video') allowedTypes = ALLOWED_VIDEO_TYPES;
      else allowedTypes = ALLOWED_DOC_TYPES;
      
      if (!allowedTypes.includes(file.type)) {
        toast.error(t("messages.invalidFileType"));
        console.error('[FileUpload] Invalid file type:', file.name, file.type);
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

      console.log('[FileUpload] uploadStarted:', fileName, 'size:', file.size, 'mime:', file.type);

      const { error: uploadError } = await supabase.storage
        .from('chat_uploads')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('[FileUpload] Storage upload error:', uploadError);
        throw uploadError;
      }
      
      console.log('[FileUpload] uploadDone:', fileName);

      // Determine message type
      let messageType: string;
      if (type === 'image') messageType = 'image';
      else if (type === 'video') messageType = 'video';
      else messageType = 'file';

      console.log('[FileUpload] messageCreateStarted, type:', messageType);

      // Insert message with storage path (not full URL)
      const { data: messageData, error: messageError } = await supabase
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
        })
        .select('id')
        .single();

      if (messageError) {
        console.error('[FileUpload] Message insert error:', messageError);
        throw messageError;
      }

      console.log('[FileUpload] messageCreated:', messageData?.id);
      
      toast.success(t("messages.fileSent"));
      onFileSent();

    } catch (err) {
      console.error('[FileUpload] error:', err);
      toast.error(t("messages.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  return (
    <>
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
    </>
  );
}
