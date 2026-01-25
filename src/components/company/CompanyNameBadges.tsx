import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PlanPill } from "@/components/company/PlanPill";

type CompanyPlanType = "free" | "starter" | "pro" | "elite";

interface CompanyNameBadgesProps {
  name: string;
  isVerified?: boolean;
  planType?: CompanyPlanType | null;
  badgeSize?: "sm" | "md";
  nameClassName?: string;
  className?: string;
  /** If true, hides the PlanPill (useful for constrained headers) */
  hidePlanPill?: boolean;
}

export function CompanyNameBadges({
  name,
  isVerified = false,
  planType = "free",
  badgeSize = "sm",
  nameClassName,
  className,
  hidePlanPill = false,
}: CompanyNameBadgesProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0 max-w-full", className)}>
      <span className={cn("truncate", nameClassName)}>{name}</span>
      <span className="inline-flex items-center gap-1 shrink-0 flex-wrap">
        {isVerified && <VerifiedBadge size={badgeSize} />}
        {!hidePlanPill && planType !== "free" && (
          <PlanPill planType={planType} size={badgeSize} />
        )}
      </span>
    </span>
  );
}

export default CompanyNameBadges;
