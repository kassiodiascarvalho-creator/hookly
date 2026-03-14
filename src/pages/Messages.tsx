import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ConversationList } from "@/components/messages/ConversationList";
import { ChatWindow } from "@/components/messages/ChatWindow";
import { MessageSquare } from "lucide-react";
import { fetchCompanyBadges, CompanyPlanType } from "@/hooks/useCompanyPlanData";

import type { FreelancerTier } from "@/components/freelancer/TierBadge";

export interface Conversation {
  id: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string | null;
  created_at: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string | null;
  other_user_tier?: FreelancerTier | null;
  other_user_type?: "company" | "freelancer";
  other_company_plan?: CompanyPlanType | null;
  other_company_verified?: boolean;
  other_freelancer_verified?: boolean;
  project_title: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface ConversationRow {
  id: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string | null;
  created_at: string;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [userType, setUserType] = useState<"company" | "freelancer" | null>(null);

  // Prevent overlapping fetch loops
  const fetchingConversationsRef = useRef(false);

  const fetchUserType = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single();

    if (!error && data?.user_type) {
      setUserType(data.user_type as "company" | "freelancer");
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!user || !userType) return;
    if (fetchingConversationsRef.current) return;

    fetchingConversationsRef.current = true;
    setLoading(true);

    try {
      // Get all conversations for this user
      const { data: conversationsData, error } = await supabase
        .from("conversations")
        .select("id, company_user_id, freelancer_user_id, project_id, created_at")
        .or(`company_user_id.eq.${user.id},freelancer_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error || !conversationsData || conversationsData.length === 0) {
        setConversations([]);
        return;
      }

      const convIds = conversationsData.map((c: ConversationRow) => c.id);

      // Determine the "other user" by comparing IDs, not by userType.
      // This makes the UI resilient even if a conversation row has roles swapped.
      const otherFreelancerIds = new Set<string>();
      const otherCompanyIds = new Set<string>();

      for (const c of conversationsData as ConversationRow[]) {
        const isUserOnCompanySide = c.company_user_id === user.id;
        const otherId = isUserOnCompanySide ? c.freelancer_user_id : c.company_user_id;
        const otherType: "company" | "freelancer" = isUserOnCompanySide ? "freelancer" : "company";

        if (!otherId || otherId === user.id) continue;
        if (otherType === "freelancer") otherFreelancerIds.add(otherId);
        else otherCompanyIds.add(otherId);
      }

      const otherFreelancerIdsArr = Array.from(otherFreelancerIds);
      const otherCompanyIdsArr = Array.from(otherCompanyIds);
      const projectIds = conversationsData
        .filter((c: ConversationRow) => c.project_id)
        .map((c: ConversationRow) => c.project_id as string);

      // Batch fetch all related data in parallel
      const [
        freelancerProfilesResult,
        companyProfilesResult,
        projectsResult,
        lastMessagesResult,
        unreadCountsResult
      ] = await Promise.all([
        // Fetch freelancer profiles for conversations where the other side is a freelancer
        otherFreelancerIdsArr.length > 0
          ? supabase
              .from("freelancer_profiles")
              .select("user_id, full_name, avatar_url, tier, verified")
              .in("user_id", otherFreelancerIdsArr)
          : Promise.resolve({ data: [] }),

        // Fetch company profiles for conversations where the other side is a company
        otherCompanyIdsArr.length > 0
          ? supabase
              .from("company_profiles")
              .select("user_id, company_name, contact_name, logo_url")
              .in("user_id", otherCompanyIdsArr)
          : Promise.resolve({ data: [] }),
        
        // Fetch projects
        projectIds.length > 0
          ? supabase
              .from("projects")
              .select("id, title")
              .in("id", projectIds)
          : Promise.resolve({ data: [] }),
        
        // Fetch last message for each conversation using a single query
        // Get all messages ordered by created_at desc, then deduplicate in JS
        (supabase as any)
          .from("messages")
          .select("conversation_id, content, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false }),
        
        // Fetch unread counts - messages not from current user and not read
        supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .neq("sender_user_id", user.id)
          .is("read_at", null)
      ]);

      // Create lookup maps
      const freelancerProfiles = new Map(
        (freelancerProfilesResult.data || []).map((p: { user_id: string; full_name: string | null; avatar_url: string | null; tier: string | null; verified: boolean | null }) => [p.user_id, p])
      );
      const companyProfiles = new Map(
        (companyProfilesResult.data || []).map((p: { user_id: string; company_name: string | null; contact_name: string | null; logo_url: string | null }) => [p.user_id, p])
      );
      const projects = new Map(
        (projectsResult.data || []).map((p: { id: string; title: string }) => [p.id, p])
      );

      // Get last message per conversation (first occurrence since ordered desc)
      const lastMessageMap = new Map<string, { content: string; created_at: string; type: string | null }>();
      for (const msg of lastMessagesResult.data || []) {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      }

      // Count unread messages per conversation
      const unreadCountMap = new Map<string, number>();
      for (const msg of unreadCountsResult.data || []) {
        unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) || 0) + 1);
      }

      // Build enriched conversations (deterministic other-side logic)
      let enrichedConversations: Conversation[] = conversationsData.map((conv: ConversationRow) => {
        const isUserOnCompanySide = conv.company_user_id === user.id;
        const otherUserId = isUserOnCompanySide ? conv.freelancer_user_id : conv.company_user_id;
        const otherUserType: "company" | "freelancer" = isUserOnCompanySide ? "freelancer" : "company";
        
        let otherUserName = "Unknown";
        let otherUserAvatar: string | null = null;
        let otherUserTier: FreelancerTier | null = null;
        let otherFreelancerVerified = false;

        if (otherUserType === "freelancer") {
          const profile = freelancerProfiles.get(otherUserId);
          if (profile) {
            otherUserName = profile.full_name || "Freelancer";
            otherUserAvatar = profile.avatar_url;
            otherUserTier = (profile.tier as FreelancerTier) || null;
            otherFreelancerVerified = profile.verified || false;
          }
        } else {
          const profile = companyProfiles.get(otherUserId);
          if (profile) {
            otherUserName = profile.company_name || profile.contact_name || "Company";
            otherUserAvatar = profile.logo_url;
          }
        }

        const project = conv.project_id ? projects.get(conv.project_id) : null;
        const lastMessage = lastMessageMap.get(conv.id);
        const unreadCount = unreadCountMap.get(conv.id) || 0;

        // Format last message content for display
        let lastMessageContent = lastMessage?.content || null;
        if (lastMessage?.type && lastMessage.type !== 'text') {
          if (lastMessage.type === 'audio') lastMessageContent = '🎤 Audio';
          else if (lastMessage.type === 'image') lastMessageContent = '📷 Image';
          else if (lastMessage.type === 'video') lastMessageContent = '🎬 Video';
          else if (lastMessage.type === 'file') lastMessageContent = '📎 File';
        }

        return {
          ...conv,
          other_user_id: otherUserId,
          other_user_name: otherUserName,
          other_user_avatar: otherUserAvatar,
          other_user_tier: otherUserTier,
          other_user_type: otherUserType,
          other_company_plan: null as CompanyPlanType | null,
          other_company_verified: false,
          other_freelancer_verified: otherFreelancerVerified,
          project_title: project?.title || null,
          last_message: lastMessageContent,
          last_message_at: lastMessage?.created_at || conv.created_at,
          unread_count: unreadCount,
        };
      });

      // Fetch company badges (plan/verified) for conversations where other user is a company.
      // Use the RPC-backed helper for consistent visibility rules.
      const companyIdsForBadges = Array.from(
        new Set(
          enrichedConversations
            .filter((c) => c.other_user_type === "company" && c.other_user_id && c.other_user_id !== user.id)
            .map((c) => c.other_user_id)
        )
      );

      if (companyIdsForBadges.length > 0) {
        const badges = await fetchCompanyBadges(companyIdsForBadges);
        enrichedConversations = enrichedConversations.map((conv) => {
          if (conv.other_user_type !== "company") return conv;
          const b = badges.get(conv.other_user_id);
          return {
            ...conv,
            other_company_plan: b?.plan_type || "free",
            other_company_verified: b?.is_verified || false,
          };
        });
      }

      // Sort by last message date
      enrichedConversations.sort((a, b) => {
        const dateA = new Date(a.last_message_at || a.created_at);
        const dateB = new Date(b.last_message_at || b.created_at);
        return dateB.getTime() - dateA.getTime();
      });

      setConversations(enrichedConversations);
    } finally {
      setLoading(false);
      fetchingConversationsRef.current = false;
    }
  }, [user, userType]);

  useEffect(() => {
    if (user) {
      fetchUserType();
    }
  }, [user, fetchUserType]);

  useEffect(() => {
    if (user && userType) {
      fetchConversations();

      // Subscribe to new conversations and messages
      const conversationsChannel = supabase
        .channel("conversations-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "conversations",
          },
          () => {
            fetchConversations();
          },
        )
        .subscribe();

      // Subscribe to message changes for unread count updates
      const messagesChannel = supabase
        .channel("messages-list-updates")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          () => {
            // Debounce updates to avoid too many fetches
            fetchConversations();
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(conversationsChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user, userType, fetchConversations]);

  // Handle conversation ID from URL params
  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (!conversationId || conversations.length === 0) return;

    // Avoid re-setting the same conversation on every refresh
    if (selectedConversation?.id === conversationId) return;

    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      setSelectedConversation(conv);
    }
  }, [searchParams, conversations, selectedConversation]);

  // Keep selectedConversation synchronized with refreshed conversation data
  useEffect(() => {
    if (!selectedConversation) return;
    const updated = conversations.find((c) => c.id === selectedConversation.id);
    if (updated && updated !== selectedConversation) {
      setSelectedConversation(updated);
    }
  }, [conversations, selectedConversation]);

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
