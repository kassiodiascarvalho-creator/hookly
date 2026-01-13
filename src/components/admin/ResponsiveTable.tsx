import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  children: ReactNode;
  mobileView: ReactNode;
  className?: string;
}

/**
 * A wrapper component that shows a table on desktop and a mobile-friendly view on mobile
 */
export function ResponsiveTable({ children, mobileView, className }: ResponsiveTableProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <div className={cn("space-y-3", className)}>{mobileView}</div>;
  }

  return <>{children}</>;
}
