import { cn } from "@/lib/utils";
import VerifiedBadge from "@/components/VerifiedBadge";
import CompanyPlanPill from "@/components/company/CompanyPlanPill";

type CompanyPlanType = "free" | "starter" | "pro" | "elite";

interface CompanyNameBadgesProps {
  name: string;
  isVerified?: boolean;
  planType?: CompanyPlanType | null;
  badgeSize?: "sm" | "md";
  className?: string;
  nameClassName?: string;
}

export function CompanyNameBadges({
  name,
  isVerified = false,
  planType = "free",
  badgeSize = "sm",
  className,
  nameClassName,
}: CompanyNameBadgesProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 min-w-0 max-w-full", className)}>
      <span className={cn("truncate", nameClassName)}>
        {name}
      </span>
      <span className="inline-flex items-center gap-1 shrink-0 flex-wrap">
        {isVerified && <VerifiedBadge size={badgeSize} />}
        {planType !== "free" && <CompanyPlanPill planType={planType} size={badgeSize} />}
      </span>
    </div>
  );
}

export default CompanyNameBadges;
