import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileDataCardProps {
  children: ReactNode;
  className?: string;
}

export function MobileDataCard({ children, className }: MobileDataCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-lg border bg-card text-card-foreground shadow-sm space-y-2",
      className
    )}>
      {children}
    </div>
  );
}

interface MobileDataRowProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function MobileDataRow({ label, children, className }: MobileDataRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-2", className)}>
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <div className="text-sm font-medium text-right">{children}</div>
    </div>
  );
}
