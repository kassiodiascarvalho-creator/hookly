import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, FileText, Download } from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";
import { Conversation } from "@/pages/Messages";
import { AudioRecorder } from "./AudioRecorder";
import { FileUploadButton } from "./FileUploadButton";
import { AudioPlayer } from "./AudioPlayer";

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
}

interface ChatWindowProps {
  conversation: Conversation;
  onBack: () => void;
  onMessagesRead: () => void;
}

export function ChatWindow({ conversation, onBack, onMessagesRead }: ChatWindowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          // Mark as read if not from current user
          if (newMsg.sender_user_id !== user?.id) {
            markMessagesAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    
    setLoading(false);
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .neq("sender_user_id", user.id)
      .is("read_at", null);

    onMessagesRead();
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_user_id: user.id,
      content: messageContent,
      type: 'text',
    });

    if (error) {
      setNewMessage(messageContent);
    }

    setSending(false);
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "HH:mm");
    } else if (isYesterday(date)) {
      return t("messages.yesterday") + " " + format(date, "HH:mm");
    } else {
      return format(date, "dd/MM/yyyy HH:mm");
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    
    messages.forEach((message) => {
      const date = new Date(message.created_at);
      let dateLabel: string;
      
      if (isToday(date)) {
        dateLabel = t("messages.today");
      } else if (isYesterday(date)) {
        dateLabel = t("messages.yesterday");
      } else {
        dateLabel = format(date, "dd MMMM yyyy");
      }

      const existingGroup = groups.find((g) => g.date === dateLabel);
      if (existingGroup) {
        existingGroup.messages.push(message);
      } else {
        groups.push({ date: dateLabel, messages: [message] });
      }
    });

    return groups;
  };

  const renderMessageContent = (message: Message, isOwn: boolean) => {
    const type = message.type || 'text';

    switch (type) {
      case 'audio':
        return (
          <AudioPlayer 
            src={message.file_url || ''} 
            duration={message.audio_duration || undefined}
            isOwn={isOwn}
          />
        );

      case 'image':
        return (
          <div className="max-w-xs">
            <img 
              src={message.file_url || ''} 
              alt={message.file_name || 'Image'}
              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.file_url || '', '_blank')}
            />
          </div>
        );

      case 'file':
        return (
          <a 
            href={message.file_url || ''} 
            target="_blank" 
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg hover:opacity-80 transition-opacity",
              isOwn ? "bg-primary-foreground/20" : "bg-background/50"
            )}
          >
            <FileText className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.file_name}</p>
              {message.file_size && (
                <p className="text-xs opacity-70">
                  {(message.file_size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <Download className="h-4 w-4 shrink-0" />
          </a>
        );

      default:
        return (
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        );
    }
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Avatar className="h-10 w-10">
          <AvatarImage src={conversation.other_user_avatar || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {conversation.other_user_name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {conversation.other_user_name}
          </p>
          {conversation.project_title && (
            <p className="text-xs text-muted-foreground truncate">
              {conversation.project_title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 && "justify-end")}>
                <Skeleton className="h-16 w-64 rounded-lg" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>{t("messages.startConversation")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                    {group.date}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.messages.map((message) => {
                    const isOwn = message.sender_user_id === user?.id;

                    return (
                      <div
                        key={message.id}
                        className={cn("flex", isOwn && "justify-end")}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          )}
                        >
                          {renderMessageContent(message, isOwn)}
                          <p
                            className={cn(
                              "text-xs mt-1",
                              isOwn
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            )}
                          >
                            {format(new Date(message.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <FileUploadButton 
            conversationId={conversation.id} 
            onFileSent={fetchMessages}
            disabled={sending}
          />
          <AudioRecorder 
            conversationId={conversation.id} 
            onAudioSent={fetchMessages}
            disabled={sending}
          />
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t("messages.typeMessage")}
            className="flex-1"
            disabled={sending}
          />
          <Button type="submit" disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
