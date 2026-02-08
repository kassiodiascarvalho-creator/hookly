import { useEffect, useRef, useCallback } from "react";
import { record, EventType } from "rrweb";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "analytics_session_id";
const MAX_EVENTS = 1000; // Limit events to prevent huge payloads
const SAVE_INTERVAL = 30000; // Save every 30 seconds

function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function getDeviceType(): string {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function useSessionRecorder(enabled: boolean = true) {
  const sessionId = useRef(getSessionId());
  const eventsRef = useRef<any[]>([]);
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pagesVisitedRef = useRef<Set<string>>(new Set([window.location.pathname]));
  const recordingIdRef = useRef<string | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const saveRecording = useCallback(async (isFinal: boolean = false) => {
    if (eventsRef.current.length === 0) return;

    const now = Date.now();
    const durationSeconds = Math.round((now - startTimeRef.current) / 1000);
    const pagesArray = Array.from(pagesVisitedRef.current);
    const isBounce = pagesArray.length === 1 && durationSeconds < 30;

    try {
      // Check if recording exists
      const { data: existing } = await (supabase
        .from("analytics_session_recordings" as any) as any)
        .select("id")
        .eq("session_id", sessionId.current)
        .single();

      if (existing) {
        // Update existing recording
        await (supabase
          .from("analytics_session_recordings" as any) as any)
          .update({
            recording_events: eventsRef.current.slice(-MAX_EVENTS), // Keep last N events
            duration_seconds: durationSeconds,
            page_count: pagesArray.length,
            pages_visited: pagesArray,
            is_bounce: isBounce,
            ended_at: isFinal ? new Date().toISOString() : null,
          })
          .eq("session_id", sessionId.current);
      } else {
        // Create new recording
        await (supabase
          .from("analytics_session_recordings" as any) as any)
          .insert({
            session_id: sessionId.current,
            recording_events: eventsRef.current.slice(-MAX_EVENTS),
            duration_seconds: durationSeconds,
            page_count: pagesArray.length,
            pages_visited: pagesArray,
            is_bounce: isBounce,
            device_type: getDeviceType(),
            started_at: new Date(startTimeRef.current).toISOString(),
          });
      }
    } catch (error) {
      console.error("Error saving session recording:", error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Start recording
    stopRecordingRef.current = record({
      emit(event) {
        // Filter out some high-frequency events to reduce size
        if (
          event.type === EventType.IncrementalSnapshot &&
          eventsRef.current.length > MAX_EVENTS
        ) {
          // Keep only essential events when buffer is full
          eventsRef.current = eventsRef.current.slice(-MAX_EVENTS / 2);
        }
        eventsRef.current.push(event);
      },
      sampling: {
        mousemove: 50, // Sample mouse movements every 50ms
        mouseInteraction: true,
        scroll: 150, // Sample scroll every 150ms
        input: "last", // Only record final input value
      },
      blockClass: "no-record",
      maskAllInputs: true, // Mask all inputs for privacy
      maskTextClass: "sensitive",
    });

    // Track page changes
    const handleRouteChange = () => {
      pagesVisitedRef.current.add(window.location.pathname);
    };

    window.addEventListener("popstate", handleRouteChange);

    // Periodic save
    saveIntervalRef.current = setInterval(() => {
      saveRecording(false);
    }, SAVE_INTERVAL);

    // Save on page unload
    const handleUnload = () => {
      saveRecording(true);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (stopRecordingRef.current) {
        stopRecordingRef.current();
      }
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("beforeunload", handleUnload);
      saveRecording(true);
    };
  }, [enabled, saveRecording]);

  return {
    sessionId: sessionId.current,
    getRecordedEvents: () => eventsRef.current,
    getSessionDuration: () => Math.round((Date.now() - startTimeRef.current) / 1000),
    getPagesVisited: () => Array.from(pagesVisitedRef.current),
  };
}
