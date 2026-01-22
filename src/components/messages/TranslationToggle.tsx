import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Languages, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TranslationToggleProps {
  className?: string;
  onAutoTranslateChange?: (enabled: boolean) => void;
}

export function TranslationToggle({ 
  className,
  onAutoTranslateChange 
}: TranslationToggleProps) {
  const { user } = useAuth();
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      const { data } = await supabase
        .from("user_translation_settings")
        .select("auto_translate_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setAutoTranslate(data.auto_translate_enabled);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user]);

  const handleToggle = async (enabled: boolean) => {
    if (!user) return;

    setAutoTranslate(enabled);
    onAutoTranslateChange?.(enabled);

    // Upsert settings
    await supabase
      .from("user_translation_settings")
      .upsert({
        user_id: user.id,
        auto_translate_enabled: enabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id",
      });
  };

  if (loading) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Languages className="h-4 w-4 text-muted-foreground" />
      <Switch
        id="auto-translate"
        checked={autoTranslate}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-primary"
      />
      <Label 
        htmlFor="auto-translate" 
        className="text-xs text-muted-foreground cursor-pointer"
      >
        Auto-tradução
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-xs">
          Quando ativado, mensagens em outros idiomas serão traduzidas automaticamente para o seu idioma.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
