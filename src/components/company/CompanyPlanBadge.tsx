import { cn } from "@/lib/utils";
import { Building2, Zap, Rocket, Crown } from "lucide-react";

export type CompanyPlanType = "free" | "starter" | "pro" | "elite";

interface CompanyPlanBadgeProps {
  planType: CompanyPlanType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const planConfig: Record<CompanyPlanType, {
  icon: typeof Building2;
  label: string;
  colorClass: string;
  bgClass: string;
}> = {
  free: {
    icon: Building2,
    label: "Free",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted border-muted-foreground/20",
  },
  starter: {
    icon: Zap,
    label: "Starter",
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
  },
  pro: {
    icon: Rocket,
    label: "PRO",
    colorClass: "text-primary",
    bgClass: "bg-primary/10 border-primary/20",
  },
  elite: {
    icon: Crown,
    label: "ELITE",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-500",
  },
};

const sizeClasses = {
  sm: "text-[8px] px-1.5 py-0.5 gap-0.5",
  md: "text-[10px] px-2 py-0.5 gap-1",
  lg: "text-xs px-2.5 py-1 gap-1",
};

const iconSizes = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

export function CompanyPlanBadge({ 
  planType, 
  size = "md", 
  showLabel = true, 
  className 
}: CompanyPlanBadgeProps) {
  // Don't show badge for free plan
  if (planType === "free") return null;

  const config = planConfig[planType];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-bold uppercase shadow-sm",
        config.bgClass,
        planType === "elite" ? "text-white" : config.colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export { planConfig };
