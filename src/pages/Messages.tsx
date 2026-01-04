import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatWindow } from "@/components/messages/ChatWindow";
import { MessageSquare } from "lucide-react";

export interface Conversation {
  id: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string | null;
  created_at: string;
  other_user_name: string;
  other_user_avatar: string | null;
  project_title: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<"company" | "freelancer" | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserType();
    }
  }, [user]);

  useEffect(() => {
    if (user && userType) {
      fetchConversations();
      
      // Subscribe to new conversations
      const channel = supabase
        .channel('conversations-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'conversations',
          },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, userType]);

  // Handle conversation ID from URL params
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        setSelectedConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  const fetchUserType = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single();
    
    if (data) {
      setUserType(data.user_type as "company" | "freelancer");
    }
  };

  const fetchConversations = async () => {
    if (!user || !userType) return;
    
    setLoading(true);
    
    const { data: conversationsData, error } = await supabase
      .from("conversations")
      .select(`
        id,
        company_user_id,
        freelancer_user_id,
        project_id,
        created_at
      `)
      .or(`company_user_id.eq.${user.id},freelancer_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error || !conversationsData) {
      setLoading(false);
      return;
    }

    // Fetch additional data for each conversation
    const enrichedConversations = await Promise.all(
      conversationsData.map(async (conv) => {
        const otherUserId = userType === "company" 
          ? conv.freelancer_user_id 
          : conv.company_user_id;

        // Get other user's profile
        let otherUserName = "Unknown";
        let otherUserAvatar: string | null = null;

        if (userType === "company") {
          const { data: freelancerProfile } = await supabase
            .from("freelancer_profiles")
            .select("full_name, avatar_url")
            .eq("user_id", otherUserId)
            .single();
          
          if (freelancerProfile) {
            otherUserName = freelancerProfile.full_name || "Freelancer";
            otherUserAvatar = freelancerProfile.avatar_url;
          }
        } else {
          const { data: companyProfile } = await supabase
            .from("company_profiles")
            .select("company_name, contact_name, logo_url")
            .eq("user_id", otherUserId)
            .single();
          
          if (companyProfile) {
            otherUserName = companyProfile.company_name || companyProfile.contact_name || "Company";
            otherUserAvatar = companyProfile.logo_url;
          }
        }

        // Get project title if exists
        let projectTitle: string | null = null;
        if (conv.project_id) {
          const { data: project } = await supabase
            .from("projects")
            .select("title")
            .eq("id", conv.project_id)
            .single();
          
          if (project) {
            projectTitle = project.title;
          }
        }

        // Get last message
        const { data: lastMessage } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_user_id", user.id)
          .is("read_at", null);

        return {
          ...conv,
          other_user_name: otherUserName,
          other_user_avatar: otherUserAvatar,
          project_title: projectTitle,
          last_message: lastMessage?.content || null,
          last_message_at: lastMessage?.created_at || conv.created_at,
          unread_count: unreadCount || 0,
        } as Conversation;
      })
    );

    // Sort by last message
    enrichedConversations.sort((a, b) => {
      const dateA = new Date(a.last_message_at || a.created_at);
      const dateB = new Date(b.last_message_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    setConversations(enrichedConversations);
    setLoading(false);
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{t("messages.title")}</h1>
        <p className="text-muted-foreground">{t("messages.subtitle")}</p>
      </div>

      <div className="flex-1 flex border border-border rounded-lg overflow-hidden bg-card min-h-0">
        {/* Conversation List */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-border flex-shrink-0 ${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col`}>
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={setSelectedConversation}
            loading={loading}
          />
        </div>

        {/* Chat Window */}
        <div className={`flex-1 ${selectedConversation ? 'flex' : 'hidden md:flex'} flex-col`}>
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
              onMessagesRead={fetchConversations}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("messages.selectConversation")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}