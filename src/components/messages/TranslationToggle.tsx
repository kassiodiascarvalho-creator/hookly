import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Languages, Info, Lock } from "lucide-react";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [userType, setUserType] = useState<"company" | "freelancer" | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get user type
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .single();
      
      const currentUserType = profile?.user_type as "company" | "freelancer" | null;
      setUserType(currentUserType);

      // Check if user has premium plan based on TIER (canonical source)
      let premium = false;
      
      if (currentUserType === "company") {
        // Companies still use company_plans for subscription status
        const { data: plan } = await supabase
          .from("company_plans")
          .select("plan_type, status")
          .eq("company_user_id", user.id)
          .maybeSingle();
        
        premium = plan?.status === "active" && 
          (plan?.plan_type === "pro" || plan?.plan_type === "elite");
      } else if (currentUserType === "freelancer") {
        // FREELANCERS: Use freelancer_profiles.tier as canonical source
        // This allows admin-assigned PRO/ELITE without Stripe subscription
        const { data: freelancerProfile } = await supabase
          .from("freelancer_profiles")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const tier = freelancerProfile?.tier || "standard";
        premium = tier === "pro" || tier === "top_rated";
      }
      
      setIsPremium(premium);

      // Get translation settings
      const { data: settings } = await supabase
        .from("user_translation_settings")
        .select("auto_translate_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings) {
        // Only enable auto-translate if user has premium
        const shouldEnable = settings.auto_translate_enabled && premium;
        setAutoTranslate(shouldEnable);
        onAutoTranslateChange?.(shouldEnable);
      }
      
      setLoading(false);
    };

    fetchData();
  }, [user, onAutoTranslateChange]);

  const handleToggle = async (enabled: boolean) => {
    if (!user || !isPremium) return;

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

  // If not premium, show locked state - compact on mobile
  if (!isPremium) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5 opacity-60 cursor-not-allowed", className)}>
            <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
            <Switch
              id="auto-translate"
              checked={false}
              disabled
              className="data-[state=checked]:bg-primary shrink-0"
            />
            <Label 
              htmlFor="auto-translate" 
              className="text-xs text-muted-foreground cursor-not-allowed items-center gap-1 hidden sm:flex whitespace-nowrap"
            >
              Auto-tradução
              <Lock className="h-3 w-3" />
            </Label>
            {/* Mobile: just show lock icon */}
            <Lock className="h-3 w-3 text-muted-foreground sm:hidden shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
          <p className="font-medium mb-1">Disponível no Plano Pro ou Elite</p>
          <p className="text-muted-foreground">
            Faça upgrade para traduzir mensagens automaticamente. 
            No plano gratuito você tem {10} traduções manuais/dia.
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
      <Switch
        id="auto-translate"
        checked={autoTranslate}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-primary shrink-0"
      />
      {/* Label hidden on mobile, shown on sm+ */}
      <Label 
        htmlFor="auto-translate" 
        className="text-xs text-muted-foreground cursor-pointer hidden sm:block whitespace-nowrap"
      >
        Auto-tradução
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px] text-xs">
          Quando ativado, mensagens em outros idiomas serão traduzidas automaticamente para o seu idioma.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
