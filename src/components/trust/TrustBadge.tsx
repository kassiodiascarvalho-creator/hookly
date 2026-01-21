import { useTranslation } from "react-i18next";
import { Shield, Lock, CheckCircle, Zap, Rocket, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type TrustVariant = 
  | "escrow" 
  | "protection" 
  | "secure" 
  | "verified" 
  | "boost" 
  | "premium"
  | "control";

interface TrustBadgeProps {
  variant: TrustVariant;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const variantConfig: Record<TrustVariant, { 
  icon: typeof Shield; 
  colorClass: string;
  bgClass: string;
}> = {
  escrow: { 
    icon: Shield, 
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
  },
  protection: { 
    icon: Lock, 
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
  },
  secure: { 
    icon: CheckCircle, 
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
  },
  verified: { 
    icon: CheckCircle, 
    colorClass: "text-primary",
    bgClass: "bg-primary/5 border-primary/20"
  },
  boost: { 
    icon: Rocket, 
    colorClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
  },
  premium: { 
    icon: Star, 
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
  },
  control: { 
    icon: Zap, 
    colorClass: "text-purple-600 dark:text-purple-400",
    bgClass: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
  },
};

export function TrustBadge({ variant, className, showIcon = true, size = "md" }: TrustBadgeProps) {
  const { t } = useTranslation();
  const config = variantConfig[variant];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-xs px-2 py-1 gap-1",
    md: "text-sm px-3 py-1.5 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
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
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{t(`trust.badges.${variant}`)}</span>
    </span>
  );
}

interface TrustMessageProps {
  messageKey: 
    | "escrowProtection" 
    | "releaseOnApproval" 
    | "fundsSecure" 
    | "creditsFlexible"
    | "verifiedTalent"
    | "secureTransaction";
  className?: string;
  showIcon?: boolean;
}

export function TrustMessage({ messageKey, className, showIcon = true }: TrustMessageProps) {
  const { t } = useTranslation();
  
  const iconMap: Record<string, typeof Shield> = {
    escrowProtection: Shield,
    releaseOnApproval: Lock,
    fundsSecure: Shield,
    creditsFlexible: Sparkles,
    verifiedTalent: CheckCircle,
    secureTransaction: Lock,
  };

  const Icon = iconMap[messageKey];

  return (
    <p className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      {showIcon && <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
      <span>{t(`trust.messages.${messageKey}`)}</span>
    </p>
  );
}

interface TrustBannerProps {
  variant?: "info" | "success" | "premium";
  messageKey: string;
  className?: string;
}

export function TrustBanner({ variant = "info", messageKey, className }: TrustBannerProps) {
  const { t } = useTranslation();

  const variantStyles = {
    info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
    success: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200",
    premium: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
  };

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      variantStyles[variant],
      className
    )}>
      <Shield className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{t(`trust.banners.${messageKey}`)}</span>
    </div>
  );
}

// Empty state with encouragement
interface EmptyStateWithCTAProps {
  icon?: typeof Shield;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

export function EmptyStateWithCTA({ 
  icon: Icon = Sparkles, 
  title, 
  description, 
  ctaLabel, 
  onCtaClick,
  className 
}: EmptyStateWithCTAProps) {
  return (
    <div className={cn("text-center py-8 px-4", className)}>
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      {ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// Value indicator for credits/boosts
interface ValueIndicatorProps {
  icon?: typeof Rocket;
  label: string;
  value: string | number;
  description?: string;
  highlight?: boolean;
  className?: string;
}

export function ValueIndicator({ 
  icon: Icon = Sparkles, 
  label, 
  value, 
  description,
  highlight = false,
  className 
}: ValueIndicatorProps) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border",
      highlight 
        ? "bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20" 
        : "bg-muted/50 border-border",
      className
    )}>
      <div className={cn(
        "p-2 rounded-lg",
        highlight ? "bg-primary/10" : "bg-background"
      )}>
        <Icon className={cn("h-4 w-4", highlight ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}
