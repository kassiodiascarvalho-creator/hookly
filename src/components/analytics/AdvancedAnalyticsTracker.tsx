import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useScrollTracker } from "@/hooks/useScrollTracker";
import { useClickTracker } from "@/hooks/useClickTracker";

interface AdvancedAnalyticsTrackerProps {
  enableScrollTracking?: boolean;
  enableClickTracking?: boolean;
}

/**
 * Component that enables advanced analytics tracking.
 * Must be rendered inside BrowserRouter.
 * 
 * Features:
 * - Scroll depth tracking (25%, 50%, 75%, 100% milestones)
 * - Click heatmap data collection
 */
export function AdvancedAnalyticsTracker({
  enableScrollTracking = true,
  enableClickTracking = true,
}: AdvancedAnalyticsTrackerProps) {
  const location = useLocation();
  
  useScrollTracker(enableScrollTracking);
  useClickTracker(enableClickTracking);

  useEffect(() => {
    // Scroll milestones reset automatically in the hook
  }, [location.pathname]);

  return null;
}
