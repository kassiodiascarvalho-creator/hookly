import type { Conversation } from "@/pages/Messages";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatWindowProps {
  conversation: Conversation;
  onBack: () => void;
  onMessagesRead: () => void;
}

export function ChatWindow({ conversation, onBack, onMessagesRead }: ChatWindowProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-foreground">{conversation.other_user_name}</span>
      </div>
      <div className="flex-1 p-4 text-muted-foreground">Chat window placeholder</div>
    </div>
  );
}
