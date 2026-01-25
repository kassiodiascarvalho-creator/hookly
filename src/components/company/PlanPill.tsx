import { cn } from "@/lib/utils";
import { Rocket } from "lucide-react";

export type CompanyPlanType = "free" | "starter" | "pro" | "elite";

interface PlanPillProps {
  planType?: CompanyPlanType | null;
  size?: "sm" | "md";
  className?: string;
}

const stylesByPlan: Record<CompanyPlanType, { container: string; label: string }> = {
  free: { container: "hidden", label: "" },
  starter: {
    container: "bg-blue-500/15 text-blue-300 border border-blue-500/25",
    label: "STARTER",
  },
  pro: {
    container: "bg-primary/15 text-primary border border-primary/25",
    label: "PRO",
  },
  elite: {
    container: "bg-amber-500/15 text-amber-300 border border-amber-500/25",
    label: "ELITE",
  },
};

const sizeClasses = {
  sm: "h-5 px-2 text-[11px] gap-1",
  md: "h-6 px-2.5 text-xs gap-1.5",
};

export function PlanPill({ planType = "free", size = "sm", className }: PlanPillProps) {
  const normalized = (planType || "free") as CompanyPlanType;
  if (normalized === "free") return null;

  const conf = stylesByPlan[normalized];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold shrink-0 whitespace-nowrap",
        conf.container,
        sizeClasses[size],
        className
      )}
      title={conf.label}
      aria-label={conf.label}
    >
      <Rocket className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {conf.label}
    </span>
  );
}

export default PlanPill;
