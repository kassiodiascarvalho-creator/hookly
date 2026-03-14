import type { Conversation } from "@/pages/Messages";

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  onSelectConversation: (conv: Conversation) => void;
  loading: boolean;
}

export function ConversationList({ conversations, selectedConversation, onSelectConversation, loading }: ConversationListProps) {
  if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;
  if (conversations.length === 0) return <div className="p-4 text-muted-foreground">No conversations</div>;

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelectConversation(conv)}
          className={`p-3 border-b border-border cursor-pointer hover:bg-muted/50 ${selectedConversation?.id === conv.id ? "bg-muted" : ""}`}
        >
          <p className="font-medium text-foreground">{conv.other_user_name}</p>
          {conv.last_message && <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>}
        </div>
      ))}
    </div>
  );
}
