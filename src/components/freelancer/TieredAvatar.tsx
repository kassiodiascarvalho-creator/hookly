import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FreelancerTier } from "./TierBadge";

interface TieredAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  tier?: FreelancerTier | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-24 w-24",
};

// Badge positioned OUTSIDE the circle (not covering the avatar)
const badgeSizeClasses = {
  sm: "text-[8px] px-1 py-0 -top-1 -right-3",
  md: "text-[9px] px-1.5 py-0.5 -top-1 -right-4",
  lg: "text-[10px] px-1.5 py-0.5 -top-1 -right-5",
  xl: "text-xs px-2 py-0.5 -top-2 -right-6",
};

const tierConfig: Record<FreelancerTier, {
  ringClass: string;
  badgeClass: string;
  label: string;
}> = {
  standard: {
    ringClass: "",
    badgeClass: "",
    label: "",
  },
  pro: {
    ringClass: "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
    badgeClass: "bg-blue-500 text-white",
    label: "PRO",
  },
  top_rated: {
    ringClass: "ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
    badgeClass: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    label: "ELITE",
  },
};

export function TieredAvatar({
  avatarUrl,
  name,
  tier = "standard",
  size = "md",
  className,
  showBadge = true,
}: TieredAvatarProps) {
  const normalizedTier = tier || "standard";
  const config = tierConfig[normalizedTier];
  const isElevated = normalizedTier !== "standard";

  return (
    <div className={cn("relative inline-block", className)}>
      <Avatar
        className={cn(
          sizeClasses[size],
          isElevated && config.ringClass,
          "transition-all"
        )}
      >
        <AvatarImage src={avatarUrl || undefined} alt={name || "Avatar"} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {name?.charAt(0).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>

      {/* Tier Badge Overlay */}
      {isElevated && showBadge && config.label && (
        <span
          className={cn(
            "absolute rounded-full font-bold uppercase shadow-lg",
            "flex items-center justify-center",
            badgeSizeClasses[size],
            config.badgeClass
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

export default TieredAvatar;
