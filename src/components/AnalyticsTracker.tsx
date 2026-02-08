import { useAnalyticsTracker } from "@/hooks/useAnalyticsTracker";

/**
 * Component that tracks page views for analytics.
 * Must be rendered inside BrowserRouter.
 */
export function AnalyticsTracker() {
  useAnalyticsTracker();
  return null;
}
