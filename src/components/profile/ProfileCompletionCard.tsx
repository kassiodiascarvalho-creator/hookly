import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, Circle, ChevronRight, Award, Coins,
  Camera, User, FileText, MapPin, Briefcase, DollarSign, Folder, CreditCard, Gift
} from "lucide-react";
import { 
  computeFreelancerCompletion, 
  computeCompanyCompletion, 
  getProgressColor,
  getCompletionStatus,
  type ProfileCompletionResult 
} from "@/lib/profileCompletion";

const iconMap: Record<string, React.ReactNode> = {
  avatar_url: <Camera className="h-4 w-4" />,
  logo_url: <Camera className="h-4 w-4" />,
  full_name: <User className="h-4 w-4" />,
  company_name: <User className="h-4 w-4" />,
  title: <Briefcase className="h-4 w-4" />,
  bio: <FileText className="h-4 w-4" />,
  about: <FileText className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  country: <MapPin className="h-4 w-4" />,
  skills: <Briefcase className="h-4 w-4" />,
  hourly_rate: <DollarSign className="h-4 w-4" />,
  portfolio: <Folder className="h-4 w-4" />,
  payout_method: <CreditCard className="h-4 w-4" />,
  payment_method: <CreditCard className="h-4 w-4" />,
  website: <FileText className="h-4 w-4" />,
  company_size: <User className="h-4 w-4" />,
  industry: <Briefcase className="h-4 w-4" />,
};

interface ProfileCompletionCardProps {
  compact?: boolean;
}

export function ProfileCompletionCard({ compact = false }: ProfileCompletionCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [completion, setCompletion] = useState<ProfileCompletionResult | null>(null);
  const [userType, setUserType] = useState<'company' | 'freelancer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [bonusCredits, setBonusCredits] = useState(10);
  const [bonusEnabled, setBonusEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCompletionData();
    }
  }, [user]);

  const fetchCompletionData = async () => {
    if (!user) return;

    try {
      // Get user type, bonus status, and bonus value in parallel
      const [profileRes, bonusRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_type, profile_completion_bonus_claimed")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("platform_action_costs")
          .select("cost_credits, is_enabled")
          .eq("action_key", "profile_completion_bonus")
          .single()
      ]);

      const profile = profileRes.data;
      
      if (!profile?.user_type) {
        setLoading(false);
        return;
      }

      setUserType(profile.user_type);
      setBonusClaimed(profile.profile_completion_bonus_claimed || false);
      
      // Set bonus value from config
      if (bonusRes.data) {
        setBonusCredits(bonusRes.data.cost_credits);
        setBonusEnabled(bonusRes.data.is_enabled);
      }

      if (profile.user_type === "freelancer") {
        // Fetch freelancer profile
        const { data: freelancerProfile } = await supabase
          .from("freelancer_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // Check for portfolio items
        const { count: portfolioCount } = await supabase
          .from("portfolio_items")
          .select("*", { count: "exact", head: true })
          .eq("freelancer_user_id", user.id);

        // Check for payout methods
        const { count: payoutCount } = await supabase
          .from("payout_methods")
          .select("*", { count: "exact", head: true })
          .eq("freelancer_user_id", user.id);

        if (freelancerProfile) {
          const result = computeFreelancerCompletion(
            freelancerProfile,
            (portfolioCount || 0) > 0,
            (payoutCount || 0) > 0
          );
          setCompletion(result);
          
          // Update profile completion percent
          await updateProfileCompletion(result.percent);
        }
      } else if (profile.user_type === "company") {
        // Fetch company profile
        const { data: companyProfile } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // Check for payment methods (not used for completion, but kept for future reference)
        // const { count: paymentMethodCount } = await supabase
        //   .from("payment_method_tokens")
        //   .select("*", { count: "exact", head: true })
        //   .eq("user_id", user.id);

        if (companyProfile) {
          const result = computeCompanyCompletion(companyProfile);
          setCompletion(result);
          
          // Update profile completion percent
          await updateProfileCompletion(result.percent);
        }
      }
    } catch (error) {
      console.error("[PROFILE] Error fetching completion data:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfileCompletion = async (percent: number) => {
    if (!user || !userType) return;
    
    console.log("[PROFILE] Attempting to update completion:", { 
      percent, 
      userId: user.id, 
      userType,
      bonusClaimed 
    });
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_completion_percent: percent,
          profile_completion_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      
      if (error) {
        console.error("[PROFILE] Error updating completion in DB:", error);
        return;
      }
      
      console.log("[PROFILE] Completion saved successfully to DB:", { percent });
      
      // Check if 100% and bonus not claimed
      if (percent >= 100 && !bonusClaimed) {
        console.log("[PROFILE] Profile complete! Attempting to claim bonus...");
        await claimCompletionBonus();
      }
    } catch (error) {
      console.error("[PROFILE] Error updating completion:", error);
    }
  };

  const claimCompletionBonus = async () => {
    if (!user || !userType || bonusClaimed) {
      console.log("[PROFILE] Skipping bonus claim:", { 
        hasUser: !!user, 
        userType, 
        bonusClaimed 
      });
      return;
    }
    
    console.log("[PROFILE] Calling grant_profile_completion_bonus RPC...", {
      userId: user.id,
      userType
    });
    
    try {
      const { data, error } = await supabase.rpc('grant_profile_completion_bonus', {
        p_user_id: user.id,
        p_user_type: userType
      });
      
      console.log("[PROFILE] RPC response:", { data, error });
      
      if (error) throw error;
      
      if (data === true) {
        console.log("[PROFILE] Bonus granted successfully!");
        setBonusClaimed(true);
        setShowCelebration(true);
        toast({
          title: t("profileCompletion.bonusClaimedTitle", "🎉 Parabéns!"),
          description: t("profileCompletion.bonusClaimedDesc", { credits: bonusCredits }),
        });
        
        // Hide celebration after 5 seconds
        setTimeout(() => setShowCelebration(false), 5000);
      } else {
        console.log("[PROFILE] Bonus not granted - already claimed or disabled");
      }
    } catch (error) {
      console.error("[PROFILE] Error claiming bonus:", error);
    }
  };

  const handleCompleteNow = (section?: string) => {
    if (section === 'portfolio') {
      navigate("/settings?tab=portfolio");
    } else if (section === 'billing') {
      navigate("/settings?tab=billing");
    } else {
      navigate("/settings?tab=profile");
    }
  };

  if (loading || !completion || !userType) {
    return null;
  }

  // Show celebration card if just completed
  if (completion.percent >= 100 && showCelebration) {
    return (
      <Card className="border-green-500/50 bg-gradient-to-br from-green-500/10 to-primary/5 animate-pulse">
        <CardContent className="p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Gift className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-green-600 mb-2">
            {t("profileCompletion.celebrationTitle", "🎉 Perfil 100% Completo!")}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {t("profileCompletion.celebrationDesc", { credits: bonusCredits })}
          </p>
          <Badge variant="default" className="gap-1">
            <Coins className="h-3 w-3" />
            +{bonusCredits} {t("profileCompletion.credits", "Créditos")}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Hide if profile is complete and celebration ended
  if (completion.percent >= 100) {
    return null;
  }

  const status = getCompletionStatus(completion.percent);
  const progressColorClass = getProgressColor(completion.percent);
  const topMissingItems = completion.missingItems.slice(0, compact ? 3 : 5);

  if (compact) {
    return (
      <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">
                {t("profileCompletion.title")}
              </span>
            </div>
            <Badge variant={status === 'high' ? 'default' : 'secondary'}>
              {completion.percent}%
            </Badge>
          </div>
          {!bonusClaimed && bonusEnabled && bonusCredits > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-2 bg-amber-500/10 px-2 py-1 rounded">
              <Gift className="h-3 w-3" />
              <span>{t("profileCompletion.bonusIncentiveShort", { credits: bonusCredits })}</span>
            </div>
          )}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-3">
            <div 
              className={`absolute left-0 top-0 h-full transition-all duration-500 ${progressColorClass}`}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <Button 
            variant="link"
            className="p-0 h-auto text-sm"
            onClick={() => handleCompleteNow()}
          >
            {t("profileCompletion.completeNow")}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" />
            {t("profileCompletion.title")}
          </CardTitle>
          <Badge 
            variant={status === 'high' ? 'default' : status === 'medium' ? 'secondary' : 'destructive'}
            className="text-sm px-3"
          >
            {completion.percent}% {t("profileCompletion.complete")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bonus incentive */}
        {!bonusClaimed && bonusEnabled && bonusCredits > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-primary/10 border border-amber-500/20">
            <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {t("profileCompletion.bonusIncentive", { credits: bonusCredits })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("profileCompletion.bonusIncentiveDesc")}
              </p>
            </div>
            <Coins className="h-5 w-5 text-amber-500" />
          </div>
        )}
        
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full transition-all duration-500 rounded-full ${progressColorClass}`}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {status === 'high' 
              ? t("profileCompletion.almostThere")
              : t("profileCompletion.keepGoing")}
          </p>
        </div>

        {/* Missing items */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t("profileCompletion.nextSteps")}:
          </p>
          <ul className="space-y-2">
            {topMissingItems.map((item) => (
              <li 
                key={item.key}
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors group"
                onClick={() => handleCompleteNow(item.section)}
              >
                <Circle className="h-4 w-4 text-muted-foreground/50" />
                <span className="flex items-center gap-2">
                  {iconMap[item.key] || <Circle className="h-4 w-4" />}
                  {t(item.label)}
                </span>
                <ChevronRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </li>
            ))}
          </ul>
        </div>

        {/* Completed items preview */}
        {completion.completedItems.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              {t("profileCompletion.completed")}: {completion.completedItems.length}/{completion.items.length}
            </p>
            <div className="flex flex-wrap gap-1">
              {completion.completedItems.slice(0, 5).map((item) => (
                <Badge key={item.key} variant="outline" className="text-xs gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {t(item.label).replace(/^Adicionar |^Add /, '')}
                </Badge>
              ))}
              {completion.completedItems.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{completion.completedItems.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button 
          className="w-full"
          onClick={() => handleCompleteNow(topMissingItems[0]?.section)}
        >
          {t("profileCompletion.completeNow")}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
