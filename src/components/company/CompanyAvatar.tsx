import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CompanyPlanBadge, CompanyPlanType } from "./CompanyPlanBadge";
import { CheckCircle2 } from "lucide-react";

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

// Plan badge positioned clearly OUTSIDE the circle
const planBadgePositionClasses = {
  sm: "-top-2 -right-2",
  md: "-top-2 -right-2",
  lg: "-top-2 -right-3",
  xl: "-top-3 -right-4",
};

// Verified badge positioned bottom-right OUTSIDE the circle
const verifiedBadgePositionClasses = {
  sm: "-bottom-1 -right-1",
  md: "-bottom-1 -right-1",
  lg: "-bottom-1 -right-2",
  xl: "-bottom-2 -right-3",
};

const verifiedIconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
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

      {/* Plan Badge - positioned OUTSIDE the circle (top-right) */}
      {isElevated && showBadge && (
        <div className={cn("absolute z-20", planBadgePositionClasses[size])}>
          <CompanyPlanBadge 
            planType={normalizedPlan} 
            size={badgeSizeMap[size]}
            showLabel={true}
          />
        </div>
      )}

      {/* Verified Badge - positioned OUTSIDE the circle (bottom-right) */}
      {isVerified && showVerified && (
        <div 
          className={cn(
            "absolute z-20 bg-background rounded-full p-0.5",
            verifiedBadgePositionClasses[size]
          )}
          title="Verified Company"
        >
          <CheckCircle2 
            className={cn(
              verifiedIconSizeClasses[size],
              "text-green-500 fill-green-500/20"
            )} 
          />
        </div>
      )}
    </div>
  );
}

export default CompanyAvatar;
