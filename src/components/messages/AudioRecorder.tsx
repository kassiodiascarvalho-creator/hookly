import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, X, Send } from "lucide-react";
import { toast } from "sonner";

interface AudioRecorderProps {
  conversationId: string;
  onAudioSent: () => void;
  disabled?: boolean;
}

export function AudioRecorder({ conversationId, onAudioSent, disabled }: AudioRecorderProps) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const finalDurationRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      audioBlobRef.current = null;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // On stop, just save the blob - DON'T upload automatically
      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (chunksRef.current.length > 0) {
          audioBlobRef.current = new Blob(chunksRef.current, { type: 'audio/webm' });
          finalDurationRef.current = recordingTime;
          setHasRecording(true);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setHasRecording(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch {
      toast.error(t("messages.microphoneError"));
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && isRecording) {
      finalDurationRef.current = recordingTime;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear timer first
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop and discard the stream without triggering onstop logic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear everything
    if (mediaRecorderRef.current) {
      // Remove the onstop handler to prevent blob creation
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    chunksRef.current = [];
    audioBlobRef.current = null;
    finalDurationRef.current = 0;
    setIsRecording(false);
    setHasRecording(false);
    setRecordingTime(0);
  };

  const discardRecording = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    audioBlobRef.current = null;
    finalDurationRef.current = 0;
    chunksRef.current = [];
    setHasRecording(false);
    setRecordingTime(0);
  };

  const sendAudio = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!audioBlobRef.current) {
      toast.error(t("messages.noAudioToSend"));
      return;
    }
    
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${conversationId}/${Date.now()}_audio.webm`;
      
      console.log('[AudioRecorder] uploadStarted:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('chat_uploads')
        .upload(fileName, audioBlobRef.current, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;
      
      console.log('[AudioRecorder] uploadDone:', fileName);

      console.log('[AudioRecorder] messageCreateStarted');
      
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_user_id: user.id,
          content: '',
          type: 'audio',
          file_url: fileName,
          file_name: 'audio.webm',
          file_mime: 'audio/webm',
          audio_duration: finalDurationRef.current
        })
        .select('id')
        .single();

      if (messageError) throw messageError;
      
      console.log('[AudioRecorder] messageCreated:', messageData?.id);

      // Clear state after successful send
      audioBlobRef.current = null;
      finalDurationRef.current = 0;
      chunksRef.current = [];
      setHasRecording(false);
      setRecordingTime(0);
      
      onAudioSent();
      
    } catch (err) {
      console.error('[AudioRecorder] error:', err);
      toast.error(t("messages.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (uploading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-5 w-5 animate-spin" />
      </Button>
    );
  }

  // Show preview state after recording stopped
  if (hasRecording && !isRecording) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-mono text-primary">{formatTime(finalDurationRef.current)}</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={discardRecording} 
          className="h-8 w-8"
          title={t("messages.discardAudio")}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={sendAudio}
          className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
          title={t("messages.sendAudio")}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Show recording state
  if (isRecording) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 bg-destructive/10 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-mono text-destructive">{formatTime(recordingTime)}</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={cancelRecording} 
          className="h-8 w-8"
          title={t("messages.cancelRecording")}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={stopRecording}
          className="h-8 w-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          title={t("messages.stopRecording")}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Default state - mic button
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={startRecording}
      disabled={disabled}
      title={t("messages.recordAudio")}
    >
      <Mic className="h-5 w-5" />
    </Button>
  );
}
