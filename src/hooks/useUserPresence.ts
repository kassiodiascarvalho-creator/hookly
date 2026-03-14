import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HEARTBEAT_INTERVAL = 25000; // 25 seconds
const ONLINE_THRESHOLD = 60000; // 60 seconds
const AWAY_THRESHOLD = 600000; // 10 minutes

export type PresenceStatus = "online" | "away" | "offline";

interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string;
}

// Hook to update current user's presence
export function usePresenceHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);

  const updatePresence = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from("user_presence")
        .upsert({
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
          status: "online",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("[usePresenceHeartbeat] Error updating presence:", error);
      }
    } catch (err) {
      console.error("[usePresenceHeartbeat] Error:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Initial update
    updatePresence();

    // Set up heartbeat interval
    intervalRef.current = window.setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updatePresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, updatePresence]);
}

// Hook to get a specific user's presence status
export function useUserPresence(userId: string | undefined) {
  const [presence, setPresence] = useState<UserPresence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPresence(null);
      setLoading(false);
      return;
    }

    const fetchPresence = async () => {
      const { data, error } = await supabase
        .from("user_presence")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setPresence(data as UserPresence);
      }
      setLoading(false);
    };

    fetchPresence();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`presence-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            setPresence(payload.new as UserPresence);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Calculate display status based on last_seen_at
  const getDisplayStatus = useCallback((): PresenceStatus => {
    if (!presence?.last_seen_at) return "offline";

    const lastSeen = new Date(presence.last_seen_at).getTime();
    const now = Date.now();
    const diff = now - lastSeen;

    if (diff < ONLINE_THRESHOLD) return "online";
    if (diff < AWAY_THRESHOLD) return "away";
    return "offline";
  }, [presence]);

  return {
    presence,
    loading,
    status: getDisplayStatus(),
    lastSeenAt: presence?.last_seen_at,
  };
}
