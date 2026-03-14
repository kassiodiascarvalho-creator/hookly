import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EventData {
  [key: string]: string | number | boolean | null | undefined;
}

const SESSION_KEY = "analytics_session_id";

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function useEventTracker() {
  const sessionId = useRef(getOrCreateSessionId());

  const trackEvent = useCallback(
    async (
      eventName: string,
      eventData: EventData = {},
      elementInfo?: {
        id?: string;
        className?: string;
        text?: string;
      }
    ) => {
      try {
        await (supabase.from("analytics_events" as any) as any).insert({
          session_id: sessionId.current,
          event_name: eventName,
          event_data: eventData,
          page_path: window.location.pathname,
          element_id: elementInfo?.id || null,
          element_class: elementInfo?.className || null,
          element_text: elementInfo?.text?.substring(0, 100) || null,
        });
      } catch (error) {
        console.error("Error tracking event:", error);
      }
    },
    []
  );

  // Predefined event helpers
  const trackCTAClick = useCallback(
    (ctaName: string, destination?: string) => {
      trackEvent("cta_click", { cta_name: ctaName, destination });
    },
    [trackEvent]
  );

  const trackSignupModalOpen = useCallback(
    (source?: string) => {
      trackEvent("signup_modal_open", { source });
    },
    [trackEvent]
  );

  const trackSignupTypeSelect = useCallback(
    (type: "company" | "freelancer") => {
      trackEvent("signup_type_select", { type });
    },
    [trackEvent]
  );

  const trackNavClick = useCallback(
    (linkName: string, href: string) => {
      trackEvent("nav_link_click", { link_name: linkName, href });
    },
    [trackEvent]
  );

  const trackFAQExpand = useCallback(
    (question: string, index: number) => {
      trackEvent("faq_expand", { question: question.substring(0, 100), index });
    },
    [trackEvent]
  );

  const trackCategoryClick = useCallback(
    (category: string) => {
      trackEvent("category_click", { category });
    },
    [trackEvent]
  );

  const trackSectionView = useCallback(
    (sectionName: string, timeSpentMs?: number) => {
      trackEvent("section_view", { section: sectionName, time_spent_ms: timeSpentMs });
    },
    [trackEvent]
  );

  const trackFormStart = useCallback(
    (formName: string) => {
      trackEvent("form_start", { form_name: formName });
    },
    [trackEvent]
  );

  const trackFormComplete = useCallback(
    (formName: string, success: boolean) => {
      trackEvent("form_complete", { form_name: formName, success });
    },
    [trackEvent]
  );

  const trackFormError = useCallback(
    (formName: string, errorField: string, errorMessage: string) => {
      trackEvent("form_error", { form_name: formName, field: errorField, message: errorMessage });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackCTAClick,
    trackSignupModalOpen,
    trackSignupTypeSelect,
    trackNavClick,
    trackFAQExpand,
    trackCategoryClick,
    trackSectionView,
    trackFormStart,
    trackFormComplete,
    trackFormError,
    sessionId: sessionId.current,
  };
}
