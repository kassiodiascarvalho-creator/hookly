import { useTranslation } from "react-i18next";
import { Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BoostedBadgeProps {
  showTooltip?: boolean;
}

export function BoostedBadge({ showTooltip = true }: BoostedBadgeProps) {
  const { t } = useTranslation();

  const badge = (
    <Badge
      variant="secondary"
      className="bg-primary/15 text-primary border-primary/30 gap-1"
    >
      <Rocket className="h-3 w-3" />
      {t("projects.boost.label")}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{t("projects.boost.description")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
