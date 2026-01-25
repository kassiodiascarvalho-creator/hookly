import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranslationDisclaimerProps {
  className?: string;
}

export function TranslationDisclaimer({ className }: TranslationDisclaimerProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 border-b border-border text-xs text-muted-foreground",
      className
    )}>
      <Info className="h-3 w-3 shrink-0" />
      <span className="flex-1">
        {t("messages.translationDisclaimer", "Traduções automáticas são assistivas. Em caso de divergência, vale o texto original.")}
      </span>
      <button
        onClick={() => setIsVisible(false)}
        className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
        aria-label={t("common.close", "Fechar")}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
