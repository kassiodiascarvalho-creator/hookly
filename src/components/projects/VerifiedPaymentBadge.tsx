import { useTranslation } from "react-i18next";
import { Shield, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedPaymentBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
}

const sizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const labelSizeClasses = {
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
};

/**
 * Badge indicating that a project has verified/prefunded payment
 */
export function VerifiedPaymentBadge({
  size = "md",
  className,
  showLabel = false,
}: VerifiedPaymentBadgeProps) {
  const { t } = useTranslation();
  
  const label = t("projects.verifiedPayment", "Pagamento Verificado");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 text-green-600 dark:text-green-500",
              className
            )}
            aria-label={label}
          >
            <ShieldCheck className={sizeClasses[size]} />
            {showLabel && (
              <span className={cn("font-medium", labelSizeClasses[size])}>
                {label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm max-w-xs">
            {t(
              "projects.verifiedPaymentTooltip",
              "Esta empresa adicionou fundos para este projeto, garantindo segurança no pagamento."
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VerifiedPaymentBadge;
