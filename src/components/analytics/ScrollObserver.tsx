import React, { useEffect, useRef, useCallback } from "react";
import { useEventTracker } from "@/hooks/useEventTracker";

interface ScrollObserverProps {
  children: React.ReactNode;
  sectionName: string;
  threshold?: number;
  onVisible?: () => void;
  className?: string;
}

export function ScrollObserver({
  children,
  sectionName,
  threshold = 0.5,
  onVisible,
  className,
}: ScrollObserverProps) {
  const { trackSectionView } = useEventTracker();
  const ref = useRef<HTMLDivElement>(null);
  const hasTrackedRef = useRef(false);
  const entryTimeRef = useRef<number | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Section entered viewport
          if (!entryTimeRef.current) {
            entryTimeRef.current = Date.now();
          }

          // Track first view
          if (!hasTrackedRef.current) {
            hasTrackedRef.current = true;
            trackSectionView(sectionName);
            onVisible?.();
          }
        } else if (entryTimeRef.current) {
          // Section left viewport - track time spent
          const timeSpent = Date.now() - entryTimeRef.current;
          if (timeSpent > 1000) {
            // Only track if viewed for more than 1 second
            trackSectionView(`${sectionName}_exit`, timeSpent);
          }
          entryTimeRef.current = null;
        }
      });
    },
    [sectionName, trackSectionView, onVisible]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin: "0px",
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection, threshold]);

  return (
    <div ref={ref} className={className} data-section={sectionName}>
      {children}
    </div>
  );
}
