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

interface ClickData {
  x: number;
  y: number;
  elementTag: string;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
}

export function useClickTracker(enabled: boolean = true) {
  const sessionId = useRef(getSessionId());
  const clicksBuffer = useRef<ClickData[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushClicks = useCallback(async () => {
    if (clicksBuffer.current.length === 0) return;

    const clicksToSend = [...clicksBuffer.current];
    clicksBuffer.current = [];

    try {
      const insertData = clicksToSend.map((click) => ({
        session_id: sessionId.current,
        interaction_type: "click",
        page_path: window.location.pathname,
        x_position: click.x,
        y_position: click.y,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        page_width: document.documentElement.scrollWidth,
        page_height: document.documentElement.scrollHeight,
      }));

      await (supabase.from("analytics_interactions" as any) as any).insert(insertData);
    } catch (error) {
      console.error("Error tracking clicks:", error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Get click position relative to document
      const scrollX = window.scrollX || document.documentElement.scrollLeft;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      
      const clickData: ClickData = {
        x: event.clientX + scrollX,
        y: event.clientY + scrollY,
        elementTag: target.tagName.toLowerCase(),
        elementId: target.id || undefined,
        elementClass: target.className?.toString?.() || undefined,
        elementText: target.textContent?.substring(0, 50) || undefined,
      };

      clicksBuffer.current.push(clickData);

      // Debounce flush - send after 2 seconds of no clicks
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushTimeoutRef.current = setTimeout(flushClicks, 2000);

      // Also flush if buffer gets too large
      if (clicksBuffer.current.length >= 10) {
        flushClicks();
      }
    };

    document.addEventListener("click", handleClick, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushClicks(); // Flush remaining clicks on unmount
    };
  }, [enabled, flushClicks]);

  return {
    sessionId: sessionId.current,
  };
}
