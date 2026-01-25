import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, FileText, Download } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { Conversation } from "@/pages/Messages";
import { AudioRecorder } from "./AudioRecorder";
import { FileUploadButton } from "./FileUploadButton";
import { AudioPlayer } from "./AudioPlayer";
import { PresenceIndicator, PresenceDot } from "./PresenceIndicator";
import { MessageTranslation } from "./MessageTranslation";
import { TranslationToggle } from "./TranslationToggle";
import { TranslationDisclaimer } from "./TranslationDisclaimer";
import { TranslationUsageBadge } from "./TranslationUsageBadge";
import { usePresenceHeartbeat } from "@/hooks/useUserPresence";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import { CompanyAvatar } from "@/components/company/CompanyAvatar";
import { CompanyNameBadges } from "@/components/company/CompanyNameBadges";
import { VerifiedBadge } from "@/components/VerifiedBadge";
interface Message {
  id: string;
  content: string;
  sender_user_id: string;
  created_at: string;
  read_at: string | null;
  type?: string;
  file_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | null;
  audio_duration?: number | null;
  lang_detected?: string | null;
}
interface MessageWithSignedUrl extends Message {
  signedUrl?: string | null;
  autoTranslation?: string | null;
}
interface ChatWindowProps {
  conversation: Conversation;
  onBack: () => void;
  onMessagesRead: () => void;
}

// Helper to check if a URL is already a full URL or a storage path
function isFullUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

// Helper to extract storage path from a full URL
function extractStoragePath(fullUrl: string): string | null {
  try {
    const url = new URL(fullUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/chat_uploads\/(.+)/);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}
export function ChatWindow({
  conversation,
  onBack,
  onMessagesRead
}: ChatWindowProps) {
  const {
    t,
    i18n
  } = useTranslation();
  const {
    user
  } = useAuth();
  const [messages, setMessages] = useState<MessageWithSignedUrl[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const signedUrlCache = useRef<Map<string, string>>(new Map());
  const autoTranslationCache = useRef<Map<string, string>>(new Map());

  // Start presence heartbeat
  usePresenceHeartbeat();

  // Get user's preferred language
  const userPreferredLang = i18n.language || "pt-BR";

  // Check premium status for auto-translation
  useEffect(() => {
    if (!user) return;
    const checkPremium = async () => {
      const {
        data: profile
      } = await supabase.from("profiles").select("user_type").eq("user_id", user.id).single();
      const userType = profile?.user_type;
      if (userType === "freelancer") {
        const {
          data: fp
        } = await supabase.from("freelancer_profiles").select("tier").eq("user_id", user.id).maybeSingle();
        const tier = fp?.tier || "standard";
        setIsPremium(tier === "pro" || tier === "top_rated");
      } else if (userType === "company") {
        const {
          data: plan
        } = await supabase.from("company_plans").select("plan_type, status").eq("company_user_id", user.id).maybeSingle();
        setIsPremium(plan?.status === "active" && (plan?.plan_type === "pro" || plan?.plan_type === "elite"));
      }
    };
    checkPremium();
  }, [user]);

  // Auto-translate a message
  const autoTranslateMessage = useCallback(async (message: MessageWithSignedUrl): Promise<string | null> => {
    // Only translate text messages from others
    if (!message.content || message.type && message.type !== "text") return null;
    if (message.sender_user_id === user?.id) return null;

    // Check cache first
    const cacheKey = `${message.id}:${userPreferredLang}`;
    const cached = autoTranslationCache.current.get(cacheKey);
    if (cached) return cached;
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("translate-message", {
        body: {
          message_id: message.id,
          target_lang: userPreferredLang,
          is_auto: true
        }
      });
      if (error || data.error || data.same_language) return null;
      const translation = data.translation;
      autoTranslationCache.current.set(cacheKey, translation);
      return translation;
    } catch (err) {
      console.error("[ChatWindow] Auto-translation error:", err);
      return null;
    }
  }, [user?.id, userPreferredLang]);

  // Apply auto-translation to messages
  const applyAutoTranslation = useCallback(async (msgs: MessageWithSignedUrl[]): Promise<MessageWithSignedUrl[]> => {
    if (!autoTranslate || !isPremium) return msgs;
    const translated = await Promise.all(msgs.map(async msg => {
      if (msg.sender_user_id === user?.id) return msg;
      if (msg.type && msg.type !== "text") return msg;
      const translation = await autoTranslateMessage(msg);
      return {
        ...msg,
        autoTranslation: translation
      };
    }));
    return translated;
  }, [autoTranslate, isPremium, user?.id, autoTranslateMessage]);

  // Generate signed URLs for messages with files - with caching
  const generateSignedUrls = useCallback(async (msgs: Message[]): Promise<MessageWithSignedUrl[]> => {
    const messagesWithUrls = await Promise.all(msgs.map(async msg => {
      if (!msg.file_url || msg.type === 'text') {
        return msg;
      }

      // Determine the storage path
      let storagePath = msg.file_url;
      if (isFullUrl(msg.file_url)) {
        const extracted = extractStoragePath(msg.file_url);
        if (extracted) {
          storagePath = extracted;
        } else {
          return {
            ...msg,
            signedUrl: msg.file_url
          };
        }
      }

      // Check cache first
      const cached = signedUrlCache.current.get(storagePath);
      if (cached) {
        return {
          ...msg,
          signedUrl: cached
        };
      }

      // Generate signed URL (1 hour expiration)
      const {
        data,
        error
      } = await supabase.storage.from('chat_uploads').createSignedUrl(storagePath, 3600);
      if (error || !data?.signedUrl) {
        console.error('Failed to generate signed URL for:', storagePath, error);
        return {
          ...msg,
          signedUrl: null
        };
      }

      // The SDK returns a full URL, cache and return it
      const fullSignedUrl = data.signedUrl;
      signedUrlCache.current.set(storagePath, fullSignedUrl);
      return {
        ...msg,
        signedUrl: fullSignedUrl
      };
    }));
    return messagesWithUrls;
  }, []);
  const fetchMessages = useCallback(async () => {
    console.log('[ChatWindow] fetchMessages started for conversation:', conversation.id);
    setLoading(true);
    const {
      data,
      error
    } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", {
      ascending: true
    });
    if (error) {
      console.error('[ChatWindow] fetchMessages error:', error);
    }
    if (!error && data) {
      console.log('[ChatWindow] fetchMessages got', data.length, 'messages');
      let messagesWithUrls = await generateSignedUrls(data);
      // Apply auto-translation if enabled
      messagesWithUrls = await applyAutoTranslation(messagesWithUrls);
      setMessages(messagesWithUrls);
      console.log('[ChatWindow] uiRendered with', messagesWithUrls.length, 'messages');
    }
    setLoading(false);
  }, [conversation.id, generateSignedUrls, applyAutoTranslation]);
  const markMessagesAsRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("messages").update({
      read_at: new Date().toISOString()
    }).eq("conversation_id", conversation.id).neq("sender_user_id", user.id).is("read_at", null);
    onMessagesRead();
  }, [user, conversation.id, onMessagesRead]);
  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();

    // Subscribe to new messages in this conversation
    console.log('[ChatWindow] Setting up realtime subscription for conversation:', conversation.id);
    const channel = supabase.channel(`messages-${conversation.id}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversation.id}`
    }, async payload => {
      console.log('[ChatWindow] realtimeEventReceived:', payload.new);
      const newMsg = payload.new as Message;

      // Check if message already exists to avoid duplicates
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMsg.id);
        if (exists) {
          console.log('[ChatWindow] Message already exists, skipping:', newMsg.id);
          return prev;
        }
        return prev; // Will update below
      });

      // Generate signed URL for the new message if it has a file
      let [msgWithUrl] = await generateSignedUrls([newMsg]);
      console.log('[ChatWindow] Generated signed URL for new message:', msgWithUrl.id, 'signedUrl:', !!msgWithUrl.signedUrl);

      // Apply auto-translation if enabled and message is from other user
      if (autoTranslate && isPremium && newMsg.sender_user_id !== user?.id) {
        const [translated] = await applyAutoTranslation([msgWithUrl]);
        msgWithUrl = translated;
      }
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMsg.id);
        if (exists) {
          return prev;
        }
        console.log('[ChatWindow] Adding new message to UI:', msgWithUrl.id);
        return [...prev, msgWithUrl];
      });

      // Mark as read if not from current user
      if (newMsg.sender_user_id !== user?.id) {
        markMessagesAsRead();
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, fetchMessages, generateSignedUrls, markMessagesAsRead, user?.id, autoTranslate, isPremium, applyAutoTranslation]);

  // Re-fetch messages when auto-translate is toggled
  useEffect(() => {
    if (!loading) {
      fetchMessages();
    }
  }, [autoTranslate]);
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  };
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");
    const {
      error
    } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      content: messageContent,
      type: 'text'
    });
    if (error) {
      setNewMessage(messageContent);
    }
    setSending(false);
  };
  const groupMessagesByDate = (messages: MessageWithSignedUrl[]) => {
    const groups: {
      date: string;
      messages: MessageWithSignedUrl[];
    }[] = [];
    messages.forEach(message => {
      const date = new Date(message.created_at);
      let dateLabel: string;
      if (isToday(date)) {
        dateLabel = t("messages.today");
      } else if (isYesterday(date)) {
        dateLabel = t("messages.yesterday");
      } else {
        dateLabel = format(date, "dd MMMM yyyy");
      }
      const existingGroup = groups.find(g => g.date === dateLabel);
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({
          date: dateLabel,
          messages: [message]
        });
      }
    });
    return groups;
  };
  const renderMessageContent = (message: MessageWithSignedUrl, isOwn: boolean) => {
    const type = message.type || 'text';
    const fileUrl = message.signedUrl || message.file_url || '';

    // Debug log for file messages
    if (type !== 'text' && !message.signedUrl) {
      console.warn('Missing signed URL for message:', message.id, 'type:', type, 'file_url:', message.file_url);
    }
    switch (type) {
      case 'audio':
        return <AudioPlayer src={fileUrl} duration={message.audio_duration || undefined} isOwn={isOwn} />;
      case 'image':
        return <div className="max-w-xs">
            {fileUrl ? <img src={fileUrl} alt={message.file_name || 'Image'} className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(fileUrl, '_blank')} loading="lazy" onError={e => {
            console.error('Image load error:', fileUrl);
            e.currentTarget.style.display = 'none';
          }} /> : <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                📷 {message.file_name || 'Image'}
              </div>}
          </div>;
      case 'video':
        return <div className="max-w-xs">
            {fileUrl ? <video src={fileUrl} controls className="rounded-lg max-w-full h-auto" preload="metadata" onError={e => {
            console.error('Video load error:', fileUrl);
          }}>
                <track kind="captions" />
                Your browser does not support the video tag.
              </video> : <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                🎬 {message.file_name || 'Video'}
              </div>}
            {message.file_name && <p className="text-xs mt-1 opacity-70 truncate">{message.file_name}</p>}
          </div>;
      case 'file':
        return <a href={fileUrl || '#'} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 p-2 rounded-lg hover:opacity-80 transition-opacity", isOwn ? "bg-primary-foreground/20" : "bg-background/50", !fileUrl && "pointer-events-none opacity-50")}>
            <FileText className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.file_name}</p>
              {message.file_size && <p className="text-xs opacity-70">
                  {(message.file_size / 1024).toFixed(1)} KB
                </p>}
            </div>
            <Download className="h-4 w-4 shrink-0" />
          </a>;
      default:
        // If auto-translation is available, show translated content
        if (message.autoTranslation && !isOwn) {
          return <div>
              <p className="whitespace-pre-wrap break-words italic text-foreground">
                {message.autoTranslation}
              </p>
              <p className="text-xs mt-1 opacity-50 line-through">
                {message.content}
              </p>
            </div>;
        }
        return <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>;
    }
  };
  const messageGroups = groupMessagesByDate(messages);
  return <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="relative">
          {conversation.other_user_type === "company" ? <CompanyAvatar logoUrl={conversation.other_user_avatar} companyName={conversation.other_user_name} planType={conversation.other_company_plan} size="md" showBadge={true} /> : <TieredAvatar avatarUrl={conversation.other_user_avatar} name={conversation.other_user_name} tier={conversation.other_user_tier} size="md" />}
          <PresenceDot userId={conversation.other_user_id} size="md" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {conversation.other_user_type === "company" ? <CompanyNameBadges name={conversation.other_user_name} isVerified={conversation.other_company_verified} planType={conversation.other_company_plan} badgeSize="sm" nameClassName="font-medium text-foreground" /> : <span className="inline-flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-foreground truncate">
                  {conversation.other_user_name}
                </span>
                {conversation.other_freelancer_verified && <VerifiedBadge size="sm" />}
              </span>}
            <PresenceIndicator userId={conversation.other_user_id} showLabel size="sm" />
          </div>
          {conversation.project_title && <p className="text-xs text-muted-foreground truncate">
              {conversation.project_title}
            </p>}
        </div>

        {/* Translation controls */}
        <div className="flex items-center gap-2">
          <TranslationUsageBadge />
          <TranslationToggle onAutoTranslateChange={setAutoTranslate} className="hidden sm:flex" />
        </div>
      </div>

      {/* Translation Disclaimer */}
      <TranslationDisclaimer />

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 px-px py-px my-0 mx-0">
        {loading ? <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
                <Skeleton className="h-16 w-64 rounded-lg" />
              </div>)}
          </div> : messages.length === 0 ? <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>{t("messages.startConversation")}</p>
          </div> : <div className="space-y-4">
            {messageGroups.map(group => <div key={group.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                    {group.date}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.messages.map(message => {
              const isOwn = message.sender_user_id === user?.id;
              return <div key={message.id} className={cn("flex", isOwn && "justify-end")}>
                        <div className={cn("max-w-[75%] rounded-2xl px-4 py-2", isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md")}>
                          {renderMessageContent(message, isOwn)}
                          <p className={cn("text-xs mt-1", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {format(new Date(message.created_at), "HH:mm")}
                          </p>
                          
                          {/* Translation button for text messages - hide if auto-translated */}
                          {(!message.type || message.type === "text") && !isOwn && !message.autoTranslation && <MessageTranslation messageId={message.id} originalContent={message.content} isOwn={isOwn} userPreferredLang={userPreferredLang} />}
                        </div>
                      </div>;
            })}
                </div>
              </div>)}
            <div ref={messagesEndRef} />
          </div>}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <FileUploadButton conversationId={conversation.id} onFileSent={fetchMessages} disabled={sending} />
          <AudioRecorder conversationId={conversation.id} onAudioSent={fetchMessages} disabled={sending} />
          <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={t("messages.typeMessage")} className="flex-1" disabled={sending} />
          <Button type="submit" disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>;
}