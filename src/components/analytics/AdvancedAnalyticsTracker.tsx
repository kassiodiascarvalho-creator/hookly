import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollTracker } from "@/hooks/useScrollTracker";
import { useClickTracker } from "@/hooks/useClickTracker";
import { useSessionRecorder } from "@/hooks/useSessionRecorder";

interface AdvancedAnalyticsTrackerProps {
  enableScrollTracking?: boolean;
  enableClickTracking?: boolean;
  enableSessionRecording?: boolean;
}

/**
 * Component that enables advanced analytics tracking.
 * Must be rendered inside BrowserRouter.
 * 
 * Features:
 * - Scroll depth tracking (25%, 50%, 75%, 100% milestones)
 * - Click heatmap data collection
 * - Session replay recording (using rrweb)
 */
export function AdvancedAnalyticsTracker({
  enableScrollTracking = true,
  enableClickTracking = true,
  enableSessionRecording = true,
}: AdvancedAnalyticsTrackerProps) {
  const location = useLocation();
  
  // Initialize trackers
  useScrollTracker(enableScrollTracking);
  useClickTracker(enableClickTracking);
  useSessionRecorder(enableSessionRecording);

  // Reset scroll tracking on route change
  useEffect(() => {
    // Scroll milestones reset automatically in the hook
  }, [location.pathname]);

  return null;
}
