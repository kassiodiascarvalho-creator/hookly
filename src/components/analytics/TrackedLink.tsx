import React from "react";
import { Link, LinkProps } from "react-router-dom";
import { useEventTracker } from "@/hooks/useEventTracker";

interface TrackedLinkProps extends LinkProps {
  eventName?: string;
  eventData?: Record<string, any>;
  navName?: string;
}

export const TrackedLink = React.forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  ({ eventName, eventData, navName, onClick, children, to, ...props }, ref) => {
    const { trackEvent, trackNavClick } = useEventTracker();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Track the event
      const href = typeof to === "string" ? to : to.pathname || "";
      
      if (navName) {
        trackNavClick(navName, href);
      } else if (eventName) {
        trackEvent(eventName, { href, ...eventData }, {
          text: typeof children === "string" ? children : undefined,
        });
      } else {
        // Default tracking for all links
        trackEvent("link_click", { href });
      }

      // Call original onClick
      onClick?.(e);
    };

    return (
      <Link ref={ref} to={to} onClick={handleClick} {...props}>
        {children}
      </Link>
    );
  }
);

TrackedLink.displayName = "TrackedLink";

// External link version
interface TrackedExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  eventName?: string;
  eventData?: Record<string, any>;
}

export const TrackedExternalLink = React.forwardRef<HTMLAnchorElement, TrackedExternalLinkProps>(
  ({ eventName, eventData, onClick, children, href, ...props }, ref) => {
    const { trackEvent } = useEventTracker();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      trackEvent(eventName || "external_link_click", { href, ...eventData }, {
        text: typeof children === "string" ? children : undefined,
      });

      onClick?.(e);
    };

    return (
      <a ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }
);

TrackedExternalLink.displayName = "TrackedExternalLink";
