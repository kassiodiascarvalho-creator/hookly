import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Loader2, X, Image, FileText } from "lucide-react";
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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export function FileUploadButton({ conversationId, onFileSent, disabled }: FileUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Reset input
    e.target.value = '';

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t("messages.fileTooLarge"));
        continue;
      }

      // Validate file type
      const allowedTypes = type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
      if (!allowedTypes.includes(file.type)) {
        toast.error(t("messages.invalidFileType"));
        continue;
      }

      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
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

      const { data: { publicUrl } } = supabase.storage
        .from('chat_uploads')
        .getPublicUrl(fileName);

      const messageType = file.type.startsWith('image/') ? 'image' : 'file';

      // Insert message with file
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: user.id,
          content: '',
          type: messageType,
          file_url: publicUrl,
          file_name: file.name,
          file_mime: file.type,
          file_size: file.size
        });

      if (messageError) throw messageError;

      onFileSent();

    } catch (error) {
      console.error('Error uploading file:', error);
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
          <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" />
            {t("messages.attachDocument")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
