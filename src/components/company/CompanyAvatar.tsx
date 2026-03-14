import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { CompanyPlanType } from "./CompanyPlanBadge";

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
  showBadge = false, // Default to false - badges are now shown next to names, not on avatar
  showVerified = false,
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
      {/* No badge overlays - verified/plan badges are shown next to name via other components */}
    </div>
  );
}

export default CompanyAvatar;
