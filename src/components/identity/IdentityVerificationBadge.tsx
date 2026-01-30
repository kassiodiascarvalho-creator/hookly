import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  ShieldX, 
  AlertTriangle,
  Shield
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type IdentityStatus = 
  | "not_started" 
  | "uploading"
  | "pending" 
  | "processing" 
  | "verified" 
  | "failed_soft" 
  | "failed_hard" 
  | "manual_review" 
  | "rejected";

interface IdentityVerificationBadgeProps {
  status: IdentityStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const statusConfig: Record<IdentityStatus, {
  icon: typeof ShieldCheck;
  colorClass: string;
  bgClass: string;
  labelKey: string;
  tooltipKey: string;
}> = {
  not_started: {
    icon: Shield,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    labelKey: "identity.status.notStarted",
    tooltipKey: "identity.tooltip.notStarted",
  },
  uploading: {
    icon: Shield,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
    labelKey: "identity.status.notStarted",
    tooltipKey: "identity.tooltip.notStarted",
  },
  pending: {
    icon: Clock,
    colorClass: "text-amber-600",
    bgClass: "bg-amber-100",
    labelKey: "identity.status.pending",
    tooltipKey: "identity.tooltip.pending",
  },
  processing: {
    icon: Clock,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-100",
    labelKey: "identity.status.processing",
    tooltipKey: "identity.tooltip.processing",
  },
  verified: {
    icon: ShieldCheck,
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-100",
    labelKey: "identity.status.verified",
    tooltipKey: "identity.tooltip.verified",
  },
  failed_soft: {
    icon: ShieldAlert,
    colorClass: "text-orange-600",
    bgClass: "bg-orange-100",
    labelKey: "identity.status.failedSoft",
    tooltipKey: "identity.tooltip.failedSoft",
  },
  failed_hard: {
    icon: ShieldX,
    colorClass: "text-red-600",
    bgClass: "bg-red-100",
    labelKey: "identity.status.failedHard",
    tooltipKey: "identity.tooltip.failedHard",
  },
  manual_review: {
    icon: AlertTriangle,
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-100",
    labelKey: "identity.status.manualReview",
    tooltipKey: "identity.tooltip.manualReview",
  },
  rejected: {
    icon: ShieldX,
    colorClass: "text-red-600",
    bgClass: "bg-red-100",
    labelKey: "identity.status.rejected",
    tooltipKey: "identity.tooltip.rejected",
  },
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const badgeSizeClasses = {
  sm: "text-xs px-1.5 py-0.5 gap-1",
  md: "text-sm px-2 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

export function IdentityVerificationBadge({
  status,
  size = "md",
  showLabel = true,
  className,
}: IdentityVerificationBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status] || statusConfig.not_started;
  const Icon = config.icon;

  const badge = (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgClass,
        config.colorClass,
        showLabel ? badgeSizeClasses[size] : "p-1",
        className
      )}
    >
      <Icon className={sizeClasses[size]} />
      {showLabel && <span>{t(config.labelKey)}</span>}
    </div>
  );

  if (!showLabel) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p>{t(config.tooltipKey)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

export default IdentityVerificationBadge;
