import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, ChevronDown, ChevronUp, AlertCircle, Lock } from "lucide-react";
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleTranslate = async () => {
    if (translation) {
      // Already translated, just toggle visibility
      setExpanded(!expanded);
      return;
    }

    // Don't allow translating own messages
    if (isOwn) {
      toast.info("Você não pode traduzir suas próprias mensagens.");
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("translate-message", {
        body: {
          message_id: messageId,
          target_lang: userPreferredLang,
          is_auto: false, // Manual translation
        },
      });

      if (fnError) {
        throw fnError;
      }

      // Handle specific error codes
      if (data.error) {
        if (data.code === "OWN_MESSAGE") {
          toast.info("Você não pode traduzir suas próprias mensagens.");
          return;
        }
        if (data.code === "DAILY_LIMIT_REACHED") {
          setErrorCode("DAILY_LIMIT_REACHED");
          setError(`Limite diário atingido (${data.limit}/dia). Faça upgrade para traduzir mais.`);
          toast.error("Limite diário de traduções atingido.");
          return;
        }
        throw new Error(data.error);
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
      const errorMessage = err.message || "Erro ao traduzir";
      
      // Check if it's a limit error from the response body
      if (errorMessage.includes("limit") || errorMessage.includes("Limit")) {
        setErrorCode("DAILY_LIMIT_REACHED");
        setError("Limite diário atingido. Faça upgrade para traduzir mais.");
      } else {
        setError(errorMessage);
      }
      
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

  // Don't show translate button for own messages
  if (isOwn) {
    return null;
  }

  return (
    <div className="mt-1">
      {/* Translate Button */}
      {!translation && !error && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTranslate}
          disabled={loading}
          className={cn(
            "h-6 px-2 text-xs gap-1",
            "text-muted-foreground hover:text-foreground hover:bg-muted"
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
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
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
            <div className="mt-1 p-2 rounded-lg text-sm border-l-2 bg-muted/50 border-primary/30 text-foreground/80">
              <p className="whitespace-pre-wrap break-words italic">
                {translation}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
          {errorCode === "DAILY_LIMIT_REACHED" ? (
            <Lock className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
