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

// Badge positioned OUTSIDE the circle
const badgePositionClasses = {
  sm: "-top-1 -right-2",
  md: "-top-1 -right-2",
  lg: "-top-1 -right-3",
  xl: "-top-2 -right-4",
};

const badgeSizeMap = {
  sm: "sm" as const,
  md: "sm" as const,
  lg: "md" as const,
  xl: "md" as const,
};

// Ring colors based on plan
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
    <div className={cn("relative inline-block", className)}>
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

      {/* Plan Badge - positioned OUTSIDE the circle */}
      {isElevated && showBadge && (
        <div className={cn("absolute", badgePositionClasses[size])}>
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
