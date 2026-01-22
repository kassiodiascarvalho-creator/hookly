import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Conversation } from "@/pages/Messages";
import { MessageSquare } from "lucide-react";
import { PresenceDot } from "./PresenceIndicator";

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conversation: Conversation) => void;
  loading: boolean;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  loading,
}: ConversationListProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">{t("messages.noConversations")}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {t("messages.noConversationsDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-accent",
              selectedConversation?.id === conversation.id && "bg-accent"
            )}
          >
            <div className="relative">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={conversation.other_user_avatar || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {conversation.other_user_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <PresenceDot userId={conversation.other_user_id} size="md" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-foreground truncate">
                  {conversation.other_user_name}
                </p>
                {conversation.last_message_at && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              {conversation.project_title && (
                <p className="text-xs text-primary truncate">
                  {conversation.project_title}
                </p>
              )}

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message || t("messages.noMessages")}
                </p>
                {conversation.unread_count > 0 && (
                  <span className="shrink-0 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}