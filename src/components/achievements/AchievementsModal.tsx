import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface AchievementsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievements: Achievement[];
  totalRevenue: number;
}

export function AchievementsModal({
  open,
  onOpenChange,
  achievements,
  totalRevenue,
}: AchievementsModalProps) {
  const { t } = useTranslation();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getProgressToNext = (achievement: Achievement) => {
    if (achievement.unlocked) return 100;
    if (achievement.required_revenue === 0) return 0;
    return Math.min((totalRevenue / achievement.required_revenue) * 100, 100);
  };

  // Find the current milestone (last unlocked or first if none unlocked)
  const currentIndex = achievements.findIndex(a => !a.unlocked) - 1;
  const currentMilestoneIndex = currentIndex >= 0 ? currentIndex : (achievements.some(a => a.unlocked) ? achievements.length - 1 : -1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("achievements.nextAchievements")}</DialogTitle>
          <DialogDescription>
            {t("achievements.modalDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {achievements.map((achievement, index) => {
            const isCurrentMilestone = index === currentMilestoneIndex;
            const progress = getProgressToNext(achievement);

            return (
              <div
                key={achievement.id}
                className={cn(
                  "relative flex items-center gap-4 p-4 rounded-xl border transition-all",
                  achievement.unlocked
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-border/50",
                  isCurrentMilestone && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                {/* Achievement Image */}
                <div className={cn(
                  "relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center",
                  achievement.unlocked ? "bg-primary/10" : "bg-muted"
                )}>
                  {achievement.image_url ? (
                    <img
                      src={achievement.image_url}
                      alt={achievement.title}
                      className={cn(
                        "w-16 h-16 object-contain transition-all",
                        !achievement.unlocked && "opacity-40 grayscale"
                      )}
                    />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded-full" />
                  )}
                  
                  {/* Lock/Unlock overlay */}
                  {!achievement.unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Achievement Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn(
                      "font-semibold text-lg",
                      achievement.unlocked ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {achievement.title}
                    </h4>
                    {achievement.unlocked ? (
                      <Badge variant="default" className="gap-1 bg-primary/20 text-primary border-0">
                        <Check className="h-3 w-3" />
                        {t("achievements.unlocked")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="h-3 w-3" />
                        {t("achievements.locked")}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {achievement.subtitle}
                  </p>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {achievement.description}
                  </p>

                  {/* Progress bar for locked achievements */}
                  {!achievement.unlocked && achievement.required_revenue > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatCurrency(totalRevenue)}</span>
                        <span>{formatCurrency(achievement.required_revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Unlocked date */}
                  {achievement.unlocked && achievement.unlocked_at && (
                    <p className="text-xs text-muted-foreground">
                      {t("achievements.unlockedAt")} {new Date(achievement.unlocked_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>

                {/* Current milestone indicator */}
                {isCurrentMilestone && (
                  <div className="absolute -top-2 -right-2">
                    <Badge variant="default" className="bg-primary text-primary-foreground">
                      {t("achievements.current")}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
