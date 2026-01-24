import { Languages, Infinity as InfinityIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslationUsage } from "@/hooks/useTranslationUsage";
import { cn } from "@/lib/utils";

interface TranslationUsageBadgeProps {
  className?: string;
}

export function TranslationUsageBadge({ className }: TranslationUsageBadgeProps) {
  const { info, loading } = useTranslationUsage();

  if (loading || !info) return null;

  const { isPremium, remaining, limit, tier } = info;

  // Premium users see "Unlimited"
  if (isPremium) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1 text-xs px-2 py-0.5 bg-primary/10 border-primary/30 text-primary",
              className
            )}
          >
            <Sparkles className="h-3 w-3" />
            Traduções: Ilimitado
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>Como usuário {tier === "top_rated" ? "Elite" : "Pro"}, você tem traduções ilimitadas!</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Free users see remaining count
  const isLow = remaining <= 3;
  const isExhausted = remaining === 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={cn(
            "gap-1 text-xs px-2 py-0.5",
            isExhausted 
              ? "bg-destructive/10 border-destructive/30 text-destructive" 
              : isLow 
                ? "bg-accent/50 border-accent text-accent-foreground"
                : "bg-muted border-border text-muted-foreground",
            className
          )}
        >
          <Languages className="h-3 w-3" />
          {remaining}/{limit} hoje
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
        {isExhausted ? (
          <p>Limite diário atingido. Faça upgrade para Pro/Elite para traduções ilimitadas.</p>
        ) : (
          <p>Você tem {remaining} traduções grátis restantes hoje. Renova à meia-noite.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
