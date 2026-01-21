import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type FreelancerTier = "standard" | "pro" | "top_rated";

interface TierBadgeProps {
  tier: FreelancerTier;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const tierConfig: Record<FreelancerTier, {
  icon: typeof Star;
  label: string;
  labelEn: string;
  colorClass: string;
  bgClass: string;
}> = {
  standard: {
    icon: Shield,
    label: "Standard",
    labelEn: "Standard",
    colorClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
  },
  pro: {
    icon: Zap,
    label: "Pro",
    labelEn: "Pro",
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
  },
  top_rated: {
    icon: Star,
    label: "Top Rated",
    labelEn: "Top Rated",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800",
  },
};

export function TierBadge({ tier, showLabel = true, size = "md", className }: TierBadgeProps) {
  const { t } = useTranslation();
  const config = tierConfig[tier];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-2.5 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        config.bgClass,
        config.colorClass,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && (
        <span>{t(`tiers.${tier}`, config.label)}</span>
      )}
    </span>
  );
}

interface TierInfoCardProps {
  tier: FreelancerTier;
  benefits: string[];
  className?: string;
}

export function TierInfoCard({ tier, benefits, className }: TierInfoCardProps) {
  const config = tierConfig[tier];
  const Icon = config.icon;

  return (
    <div className={cn(
      "rounded-lg border p-4",
      config.bgClass,
      className
    )}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("h-5 w-5", config.colorClass)} />
        <span className={cn("font-semibold", config.colorClass)}>
          {config.label}
        </span>
      </div>
      <ul className="space-y-2">
        {benefits.map((benefit, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{benefit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Export tier config for use elsewhere
export { tierConfig };
export type { FreelancerTier };
