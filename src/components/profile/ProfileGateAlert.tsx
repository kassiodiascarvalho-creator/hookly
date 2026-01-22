import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileGateAlertProps {
  completionPercent: number;
  userType: 'freelancer' | 'company';
  className?: string;
}

export function ProfileGateAlert({
  completionPercent,
  userType,
  className,
}: ProfileGateAlertProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-yellow-500';
    if (percent >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Alert className={cn("border-amber-500/50 bg-amber-500/10", className)}>
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <div className="flex-1 space-y-2">
          <p className="font-medium text-foreground">
            {userType === 'freelancer' 
              ? t('profileGate.freelancerAlertTitle')
              : t('profileGate.companyAlertTitle')
            }
          </p>
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 max-w-[200px] bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", getProgressColor(completionPercent))}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">{completionPercent}%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            🎁 {t('profileGate.bonusHint')}
          </p>
        </div>
        <Button 
          size="sm" 
          onClick={() => navigate("/settings?tab=profile")}
          className="gap-1 shrink-0"
        >
          {t('profileGate.completeNow')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
