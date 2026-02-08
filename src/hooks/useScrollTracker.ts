import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "analytics_session_id";

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

interface ScrollMilestone {
  percentage: number;
  reached: boolean;
}

export function useScrollTracker(enabled: boolean = true) {
  const sessionId = useRef(getSessionId());
  const milestonesRef = useRef<ScrollMilestone[]>([
    { percentage: 25, reached: false },
    { percentage: 50, reached: false },
    { percentage: 75, reached: false },
    { percentage: 100, reached: false },
  ]);
  const lastScrollDepthRef = useRef(0);
  const maxScrollDepthRef = useRef(0);

  const trackScrollDepth = useCallback(async (depth: number) => {
    try {
      await (supabase.from("analytics_interactions" as any) as any).insert({
        session_id: sessionId.current,
        interaction_type: "scroll",
        page_path: window.location.pathname,
        scroll_depth: depth,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        page_width: document.documentElement.scrollWidth,
        page_height: document.documentElement.scrollHeight,
      });
    } catch (error) {
      console.error("Error tracking scroll:", error);
    }
  }, []);

  const trackScrollEvent = useCallback(async (milestone: number) => {
    try {
      await (supabase.from("analytics_events" as any) as any).insert({
        session_id: sessionId.current,
        event_name: "scroll_depth",
        event_data: { depth: milestone },
        page_path: window.location.pathname,
      });
    } catch (error) {
      console.error("Error tracking scroll event:", error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

      // Track max scroll depth
      if (scrollPercentage > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = scrollPercentage;
      }

      // Check milestones
      milestonesRef.current.forEach((milestone) => {
        if (!milestone.reached && scrollPercentage >= milestone.percentage) {
          milestone.reached = true;
          trackScrollEvent(milestone.percentage);
          trackScrollDepth(milestone.percentage);
        }
      });

      lastScrollDepthRef.current = scrollPercentage;
    };

    // Throttle scroll events
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });

    // Reset milestones on page change
    return () => {
      window.removeEventListener("scroll", throttledScroll);
      milestonesRef.current = milestonesRef.current.map((m) => ({ ...m, reached: false }));
      maxScrollDepthRef.current = 0;
    };
  }, [enabled, trackScrollDepth, trackScrollEvent]);

  return {
    getMaxScrollDepth: () => maxScrollDepthRef.current,
    getCurrentScrollDepth: () => lastScrollDepthRef.current,
  };
}
