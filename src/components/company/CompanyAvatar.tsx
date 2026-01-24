import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CompanyPlanBadge, CompanyPlanType } from "./CompanyPlanBadge";

interface CompanyAvatarProps {
  logoUrl?: string | null;
  companyName?: string | null;
  planType?: CompanyPlanType | null;
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

// Badge positioned clearly OUTSIDE the circle - more aggressive offset
const badgePositionClasses = {
  sm: "-top-2 -right-3 translate-x-1/4",
  md: "-top-2 -right-3 translate-x-1/4",
  lg: "-top-2 -right-4 translate-x-1/3",
  xl: "-top-3 -right-5 translate-x-1/3",
};

const badgeSizeMap = {
  sm: "sm" as const,
  md: "sm" as const,
  lg: "md" as const,
  xl: "md" as const,
};

// Ring colors based on plan - ring-offset ensures gap between ring and avatar
const planRingClasses: Record<CompanyPlanType, string> = {
  free: "",
  starter: "ring-2 ring-blue-500 ring-offset-2 ring-offset-background",
  pro: "ring-2 ring-primary ring-offset-2 ring-offset-background",
  elite: "ring-2 ring-amber-500 ring-offset-2 ring-offset-background",
};

export function CompanyAvatar({
  logoUrl,
  companyName,
  planType = "free",
  size = "md",
  className,
  showBadge = true,
}: CompanyAvatarProps) {
  const normalizedPlan = planType || "free";
  const isElevated = normalizedPlan !== "free";

  return (
    <div className={cn("relative inline-block overflow-visible", className)}>
      <Avatar
        className={cn(
          sizeClasses[size],
          isElevated && planRingClasses[normalizedPlan],
          "transition-all"
        )}
      >
        <AvatarImage src={logoUrl || undefined} alt={companyName || "Company"} />
        <AvatarFallback className="bg-primary text-primary-foreground">
          {companyName?.charAt(0).toUpperCase() || "C"}
        </AvatarFallback>
      </Avatar>

      {/* Plan Badge - positioned clearly OUTSIDE the circle with z-index */}
      {isElevated && showBadge && (
        <div className={cn("absolute z-10", badgePositionClasses[size])}>
          <CompanyPlanBadge 
            planType={normalizedPlan} 
            size={badgeSizeMap[size]}
            showLabel={true}
          />
        </div>
      )}
    </div>
  );
}

export default CompanyAvatar;
