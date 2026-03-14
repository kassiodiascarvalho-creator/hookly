import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Generate or retrieve session ID
const getSessionId = (): string => {
  const key = "analytics_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

// Detect device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return "mobile";
  if (/tablet/i.test(ua)) return "tablet";
  return "desktop";
};

// Get referrer source
const getReferrer = (): string | null => {
  const referrer = document.referrer;
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    // Don't track internal referrers
    if (url.hostname === window.location.hostname) return null;
    return referrer;
  } catch {
    return null;
  }
};

// Fetch country from IP (using free API)
const getCountry = async (): Promise<string> => {
  try {
    // Check if we already have the country cached
    const cached = sessionStorage.getItem("analytics_country");
    if (cached) return cached;

    const response = await fetch("https://ipapi.co/json/", { 
      signal: AbortSignal.timeout(3000) 
    });
    if (!response.ok) return "Unknown";
    
    const data = await response.json();
    const country = data.country_code || "Unknown";
    sessionStorage.setItem("analytics_country", country);
    return country;
  } catch {
    return "Unknown";
  }
};

export function useAnalyticsTracker() {
  const location = useLocation();
  const lastPath = useRef<string>("");

  useEffect(() => {
    // Don't track if already tracked this path in this render
    if (lastPath.current === location.pathname) return;
    lastPath.current = location.pathname;

    const trackPageView = async () => {
      try {
        const sessionId = getSessionId();
        const deviceType = getDeviceType();
        const referrer = getReferrer();
        const country = await getCountry();

        // Use type assertion since the table will be created by migration
        await (supabase.from("analytics_page_views" as any) as any).insert({
          session_id: sessionId,
          page_path: location.pathname,
          referrer,
          user_agent: navigator.userAgent,
          device_type: deviceType,
          country,
        });
      } catch (error) {
        // Silently fail - analytics shouldn't break the app
        console.debug("Analytics tracking failed:", error);
      }
    };

    trackPageView();
  }, [location.pathname]);
}
