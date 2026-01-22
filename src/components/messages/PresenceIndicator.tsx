import { useUserPresence, PresenceStatus } from "@/hooks/useUserPresence";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PresenceIndicatorProps {
  userId: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusColors: Record<PresenceStatus, string> = {
  online: "bg-green-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/50",
};

const statusLabels: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Ausente",
  offline: "Offline",
};

const sizeClasses = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export function PresenceIndicator({ 
  userId, 
  showLabel = false, 
  size = "md",
  className 
}: PresenceIndicatorProps) {
  const { t, i18n } = useTranslation();
  const { status, lastSeenAt, loading } = useUserPresence(userId);

  if (loading) {
    return null;
  }

  const getTooltipContent = () => {
    if (status === "online") {
      return "Ativo agora";
    }
    if (lastSeenAt) {
      const distance = formatDistanceToNow(new Date(lastSeenAt), {
        addSuffix: true,
        locale: i18n.language === "pt" || i18n.language === "pt-BR" ? ptBR : undefined,
      });
      return `Visto ${distance}`;
    }
    return statusLabels[status];
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1.5", className)}>
          <span
            className={cn(
              "rounded-full ring-2 ring-background",
              sizeClasses[size],
              statusColors[status],
              status === "online" && "animate-pulse"
            )}
          />
          {showLabel && (
            <span
              className={cn(
                "text-xs font-medium",
                status === "online" && "text-green-600 dark:text-green-400",
                status === "away" && "text-amber-600 dark:text-amber-400",
                status === "offline" && "text-muted-foreground"
              )}
            >
              {statusLabels[status]}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {getTooltipContent()}
      </TooltipContent>
    </Tooltip>
  );
}

// Simple dot indicator for avatars
export function PresenceDot({ 
  userId, 
  size = "md",
  className 
}: { 
  userId: string; 
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { status, loading } = useUserPresence(userId);

  if (loading || status === "offline") {
    return null;
  }

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 rounded-full ring-2 ring-background",
        sizeClasses[size],
        statusColors[status],
        status === "online" && "animate-pulse",
        className
      )}
    />
  );
}
