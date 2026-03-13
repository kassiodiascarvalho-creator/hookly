

## Plan: Disable Session Recording (rrweb)

### What changes
1. **`src/App.tsx`** — Pass `enableSessionRecording={false}` to `<AdvancedAnalyticsTracker />`
2. **`src/components/analytics/AdvancedAnalyticsTracker.tsx`** — Remove the `useSessionRecorder` import and call (clean up unused code)
3. **`src/hooks/useSessionRecorder.ts`** — Delete this file entirely (no longer needed)
4. **`src/components/admin/analytics/SessionReplayTab.tsx`** — Update to show an "inactive/disabled" message instead of trying to load recordings
5. **`src/pages/admin/AdminAnalytics.tsx`** — Optionally hide or gray out the "Replays" tab, or keep it with a "disabled" notice

### What stays active
- Page view tracking (`AnalyticsTracker`)
- Scroll depth tracking (`useScrollTracker`)
- Click heatmap tracking (`useClickTracker`)
- Event tracking (`useEventTracker`, `TrackedButton`, etc.)
- Tracking pixels
- All admin analytics tabs (Events, Heatmap, Funnel)

### Performance benefit
Removing rrweb eliminates continuous DOM mutation observation, reducing CPU/memory usage for all visitors.

