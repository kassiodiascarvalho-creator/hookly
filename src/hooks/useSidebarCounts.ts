import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarCounts {
  unreadConversationsCount: number;
  pendingInvitesCount: number;
  loading: boolean;
}

export function useSidebarCounts(): SidebarCounts {
  const { user } = useAuth();
  const [unreadConversationsCount, setUnreadConversationsCount] = useState(0);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUnreadConversationsCount(0);
      setPendingInvitesCount(0);
      setLoading(false);
      return;
    }

    const fetchCounts = async () => {
      try {
        // Fetch unread messages count (messages not sent by current user and not read)
        const { count: unreadCount } = await supabase
          .from("messages")
          .select("id, conversation:conversations!inner(id)", { count: "exact", head: true })
          .neq("sender_user_id", user.id)
          .is("read_at", null)
          .or(`company_user_id.eq.${user.id},freelancer_user_id.eq.${user.id}`, { 
            referencedTable: "conversations" 
          });

        // Count distinct conversations with unread messages
        const { data: unreadConversations } = await supabase
          .from("messages")
          .select("conversation_id, conversations!inner(company_user_id, freelancer_user_id)")
          .neq("sender_user_id", user.id)
          .is("read_at", null)
          .or(`company_user_id.eq.${user.id},freelancer_user_id.eq.${user.id}`, { 
            referencedTable: "conversations" 
          });

        const uniqueConversations = new Set(unreadConversations?.map(m => m.conversation_id) || []);
        setUnreadConversationsCount(uniqueConversations.size);

        // Fetch pending invites count (for freelancers)
        const { count: invitesCount } = await supabase
          .from("project_invites")
          .select("id", { count: "exact", head: true })
          .eq("freelancer_user_id", user.id)
          .eq("status", "pending");

        setPendingInvitesCount(invitesCount || 0);
      } catch (error) {
        console.error("Error fetching sidebar counts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();

    // Subscribe to realtime changes for messages
    const messagesChannel = supabase
      .channel("sidebar-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Subscribe to realtime changes for invites
    const invitesChannel = supabase
      .channel("sidebar-invites")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_invites",
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    // Polling fallback every 60 seconds
    const pollInterval = setInterval(fetchCounts, 60000);

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(invitesChannel);
      clearInterval(pollInterval);
    };
  }, [user]);

  return {
    unreadConversationsCount,
    pendingInvitesCount,
    loading,
  };
}
