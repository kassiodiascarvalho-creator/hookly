import React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import { useEventTracker } from "@/hooks/useEventTracker";

interface TrackedButtonProps extends ButtonProps {
  eventName?: string;
  eventData?: Record<string, any>;
  ctaName?: string;
}

export const TrackedButton = React.forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ eventName, eventData, ctaName, onClick, children, ...props }, ref) => {
    const { trackEvent, trackCTAClick } = useEventTracker();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Track the event
      if (ctaName) {
        trackCTAClick(ctaName);
      } else if (eventName) {
        trackEvent(eventName, eventData || {}, {
          id: props.id,
          className: props.className,
          text: typeof children === "string" ? children : undefined,
        });
      }

      // Call original onClick
      onClick?.(e);
    };

    return (
      <Button ref={ref} onClick={handleClick} {...props}>
        {children}
      </Button>
    );
  }
);

TrackedButton.displayName = "TrackedButton";
