import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MessageTranslationProps {
  messageId: string;
  originalContent: string;
  isOwn: boolean;
  userPreferredLang: string;
}

export function MessageTranslation({
  messageId,
  originalContent,
  isOwn,
  userPreferredLang,
}: MessageTranslationProps) {
  const { t } = useTranslation();
  const [translation, setTranslation] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleTranslate = async () => {
    if (translation) {
      // Already translated, just toggle visibility
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("translate-message", {
        body: {
          message_id: messageId,
          target_lang: userPreferredLang,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.same_language) {
        toast.info("A mensagem já está no seu idioma.");
        return;
      }

      setTranslation(data.translation);
      setSourceLang(data.source_lang);
      setExpanded(true);
    } catch (err: any) {
      console.error("Translation error:", err);
      setError(err.message || "Erro ao traduzir");
      toast.error("Não foi possível traduzir a mensagem.");
    } finally {
      setLoading(false);
    }
  };

  const getLangLabel = (lang: string | null) => {
    const labels: Record<string, string> = {
      "pt-BR": "Português",
      "pt": "Português",
      "en": "Inglês",
      "es": "Espanhol",
      "fr": "Francês",
      "de": "Alemão",
      "zh": "Chinês",
    };
    return labels[lang || ""] || lang || "Desconhecido";
  };

  return (
    <div className="mt-1">
      {/* Translate Button */}
      {!translation && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTranslate}
          disabled={loading}
          className={cn(
            "h-6 px-2 text-xs gap-1",
            isOwn 
              ? "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" />
          )}
          {loading ? "Traduzindo..." : "Traduzir"}
        </Button>
      )}

      {/* Translation Result */}
      {translation && (
        <div className="mt-2">
          {/* Toggle Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex items-center gap-1 text-xs",
              isOwn 
                ? "text-primary-foreground/60 hover:text-primary-foreground/80" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Languages className="h-3 w-3" />
            <span>
              Traduzido de {getLangLabel(sourceLang)} para {getLangLabel(userPreferredLang)}
            </span>
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {/* Translation Content */}
          {expanded && (
            <div
              className={cn(
                "mt-1 p-2 rounded-lg text-sm border-l-2",
                isOwn 
                  ? "bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground/90" 
                  : "bg-muted/50 border-primary/30 text-foreground/80"
              )}
            >
              <p className="whitespace-pre-wrap break-words italic">
                {translation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-xs",
          isOwn ? "text-red-200" : "text-destructive"
        )}>
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
