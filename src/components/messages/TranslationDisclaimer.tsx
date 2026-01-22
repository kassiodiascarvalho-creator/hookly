import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranslationDisclaimerProps {
  className?: string;
}

export function TranslationDisclaimer({ className }: TranslationDisclaimerProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border-b border-border text-xs text-muted-foreground",
      className
    )}>
      <Info className="h-3 w-3 shrink-0" />
      <span>
        {t("messages.translationDisclaimer", "Traduções automáticas são assistivas. Em caso de divergência, vale o texto original.")}
      </span>
    </div>
  );
}
