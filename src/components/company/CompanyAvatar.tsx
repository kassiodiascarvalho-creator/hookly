import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CompanyPlanBadge, CompanyPlanType } from "./CompanyPlanBadge";

interface CompanyAvatarProps {
  logoUrl?: string | null;
  companyName?: string | null;
  planType?: CompanyPlanType | null;
  isVerified?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
  showVerified?: boolean;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-24 w-24",
};

// Ring padding for the wrapper
const ringPaddingClasses = {
  sm: "p-[2px]",
  md: "p-[2px]",
  lg: "p-[3px]",
  xl: "p-[4px]",
};

// Plan badge positioned OUTSIDE the circle (more to the right)
const planBadgePositionClasses = {
  sm: "-top-1 right-0 translate-x-[75%]",
  md: "-top-1 right-0 translate-x-[85%]",
  lg: "-top-1 right-0 translate-x-[95%]",
  xl: "-top-2 right-0 translate-x-[105%]",
};

const badgeSizeMap = {
  sm: "sm" as const,
  md: "sm" as const,
  lg: "md" as const,
  xl: "md" as const,
};

// Ring colors based on plan
const planRingClasses: Record<CompanyPlanType, string> = {
  free: "ring-transparent",
  starter: "ring-blue-500",
  pro: "ring-primary",
  elite: "ring-amber-500",
};

export function CompanyAvatar({
  logoUrl,
  companyName,
  planType = "free",
  isVerified = false,
  size = "md",
  className,
  showBadge = true,
  showVerified = true,
}: CompanyAvatarProps) {
  const normalizedPlan = planType || "free";
  const isElevated = normalizedPlan !== "free";

  // isVerified and showVerified kept for TypeScript compatibility but not rendered here
  // Verified badge is now shown next to the name using VerifiedBadge component

  return (
    <div className={cn("relative inline-flex overflow-visible", className)}>
      {/* Ring wrapper - applies ring OUTSIDE the avatar */}
      <div
        className={cn(
          "rounded-full",
          ringPaddingClasses[size],
          isElevated && [
            "ring-2",
            planRingClasses[normalizedPlan],
          ],
          "transition-all"
        )}
      >
        <Avatar className={cn(sizeClasses[size])}>
          <AvatarImage src={logoUrl || undefined} alt={companyName || "Company"} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {companyName?.charAt(0).toUpperCase() || "C"}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Plan Badge - positioned OUTSIDE the circle (top-right, more to the side) */}
      {isElevated && showBadge && (
        <div className={cn("absolute z-20", planBadgePositionClasses[size])}>
          <CompanyPlanBadge 
            planType={normalizedPlan} 
            size={badgeSizeMap[size]}
            showLabel={true}
          />
        </div>
      )}

      {/* Verified badge is now shown next to name via VerifiedBadge component */}
    </div>
  );
}

export default CompanyAvatar;
