import { VerifiedBadge } from "@/components/VerifiedBadge";
import { CompanyPlanBadge, CompanyPlanType } from "@/components/company/CompanyPlanBadge";

interface CompanyNameBadgesProps {
  name: string;
  isVerified: boolean;
  planType: CompanyPlanType;
  badgeSize?: "sm" | "md" | "lg";
  nameClassName?: string;
}

export function CompanyNameBadges({ name, isVerified, planType, nameClassName }: CompanyNameBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={nameClassName}>{name}</span>
      {isVerified && <VerifiedBadge />}
      {planType !== "free" && <CompanyPlanBadge planType={planType} />}
    </div>
  );
}
