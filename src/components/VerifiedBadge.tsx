import { cn } from "@/lib/utils";

type VerifiedBadgeSize = "sm" | "md" | "lg";

interface VerifiedBadgeProps {
  size?: VerifiedBadgeSize;
  className?: string;
  title?: string;
}

const sizeClasses: Record<VerifiedBadgeSize, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const checkSizeClasses: Record<VerifiedBadgeSize, string> = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
};

export function VerifiedBadge({
  size = "md",
  className,
  title = "Verificado",
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "bg-[#0095F6] text-white",
        sizeClasses[size],
        className
      )}
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 24 24" className={checkSizeClasses[size]} fill="none" aria-hidden="true">
        <path
          d="M20 6L9 17l-5-5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default VerifiedBadge;
