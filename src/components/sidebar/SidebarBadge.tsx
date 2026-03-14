import { cn } from "@/lib/utils";

interface SidebarBadgeProps {
  count: number;
  cap?: number;
  collapsed?: boolean;
  ariaLabel: string;
  className?: string;
}

export function SidebarBadge({ 
  count, 
  cap = 9, 
  collapsed = false, 
  ariaLabel,
  className 
}: SidebarBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > cap ? `${cap}+` : count.toString();

  // In collapsed mode, show a dot instead of number
  if (collapsed) {
    return (
      <span
        className={cn(
          "absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive",
          className
        )}
        aria-label={ariaLabel}
        role="status"
      />
    );
  }

  return (
    <span
      className={cn(
        "ml-auto flex min-w-[20px] h-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground",
        className
      )}
      aria-label={ariaLabel}
      role="status"
    >
      {displayCount}
    </span>
  );
}
