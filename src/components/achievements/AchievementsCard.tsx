import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, TrendingUp, ChevronRight } from "lucide-react";
import { AchievementsModal } from "./AchievementsModal";

interface Achievement {
  id: string;
  achievement_key: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  required_revenue: number;
  unlocked: boolean;
  unlocked_at: string | null;
  display_order: number;
  image_url: string | null;
}

interface AchievementsCardProps {
  freelancerUserId?: string;
}

export function AchievementsCard({ freelancerUserId }: AchievementsCardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const targetUserId = freelancerUserId || user?.id;

  useEffect(() => {
    if (targetUserId) {
      fetchData();
    }
  }, [targetUserId]);

  const fetchData = async () => {
    if (!targetUserId) return;

    try {
      // Initialize achievements if needed (call the database function)
      // This may fail if RPC is not available, so we catch and continue
      try {
        await supabase.rpc('initialize_freelancer_achievements', {
          p_freelancer_user_id: targetUserId
        });
      } catch (rpcError) {
        console.log("RPC init skipped:", rpcError);
      }

      // Fetch achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from("freelancer_achievements")
        .select("*")
        .eq("freelancer_user_id", targetUserId)
        .order("display_order", { ascending: true });

      if (achievementsError) {
        console.error("Error fetching achievements:", achievementsError);
      }

      if (achievementsData) {
        setAchievements(achievementsData);
      }

      // Fetch real revenue from user_balances (escrow + earnings, stored in cents)
      const { data: balanceData } = await supabase
        .from("user_balances")
        .select("earnings_available, escrow_held")
        .eq("user_id", targetUserId)
        .eq("user_type", "freelancer")
        .maybeSingle();

      if (balanceData) {
        // Convert from cents to currency units
        const earningsCents = Number(balanceData.earnings_available || 0) + Number(balanceData.escrow_held || 0);
        setTotalRevenue(earningsCents / 100);
      } else {
        // Fallback to freelancer_profiles total_revenue if no balance record
        const { data: profileData } = await supabase
          .from("freelancer_profiles")
          .select("total_revenue")
          .eq("user_id", targetUserId)
          .single();

        if (profileData) {
          setTotalRevenue(profileData.total_revenue || 0);
        }
      }
    } catch (error) {
      console.error("Error fetching achievements data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const currentAchievement = achievements.find(a => a.unlocked) || achievements[0];
  const nextAchievement = achievements.find(a => !a.unlocked);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 bg-gradient-to-br from-card to-card/80">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t("achievements.myEvolution")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("achievements.updatedDaily")}
              </p>
            </div>
            {currentAchievement && currentAchievement.image_url && (
              <img 
                src={currentAchievement.image_url} 
                alt={currentAchievement.title}
                className="h-16 w-16 object-contain"
              />
            )}
          </div>

          <div className="text-center py-4">
            <p className="text-4xl font-bold text-primary">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("achievements.currentRevenue")}
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {unlockedCount > 0 
                    ? t("achievements.youAreDoing")
                    : t("achievements.startYourJourney")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {unlockedCount}/{achievements.length} {t("achievements.milestonesUnlocked")}
                </p>
              </div>
              {nextAchievement && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t("achievements.next")}</p>
                  <p className="text-sm font-medium text-primary">{nextAchievement.title}</p>
                </div>
              )}
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4 gap-2"
            onClick={() => setModalOpen(true)}
          >
            {t("achievements.viewNextAchievements")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <AchievementsModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        achievements={achievements}
        totalRevenue={totalRevenue}
      />
    </>
  );
}
