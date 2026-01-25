import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

type CompanyPlanType = "free" | "starter" | "pro" | "elite";

interface CompanyPlanPillProps {
  planType?: CompanyPlanType | null;
  size?: "sm" | "md";
  className?: string;
}

const sizeCls = {
  sm: "h-5 px-2 text-[10px]",
  md: "h-6 px-2.5 text-xs",
};

export function CompanyPlanPill({ planType = "free", size = "sm", className }: CompanyPlanPillProps) {
  const p = (planType || "free") as CompanyPlanType;
  if (p === "free") return null;

  const label = p.toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold shrink-0",
        "bg-primary text-primary-foreground",
        sizeCls[size],
        className
      )}
      title={label}
      aria-label={label}
    >
      <Rocket className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {label}
    </span>
  );
}

export default CompanyPlanPill;
