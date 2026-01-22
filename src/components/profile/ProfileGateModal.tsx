import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, Camera, FileText, MapPin, Briefcase, DollarSign, 
  FolderOpen, Award, Building2, Globe, Users, Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completionPercent: number;
  userType: 'freelancer' | 'company';
  missingItems?: string[];
}

const freelancerMissingLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  avatar_url: { label: 'profileCompletion.addPhoto', icon: <Camera className="h-4 w-4" /> },
  full_name: { label: 'profileCompletion.addFullName', icon: <User className="h-4 w-4" /> },
  title: { label: 'profileCompletion.addTitle', icon: <Briefcase className="h-4 w-4" /> },
  bio: { label: 'profileCompletion.addBio', icon: <FileText className="h-4 w-4" /> },
  location: { label: 'profileCompletion.addLocation', icon: <MapPin className="h-4 w-4" /> },
  country: { label: 'profileCompletion.addCountry', icon: <MapPin className="h-4 w-4" /> },
  skills: { label: 'profileCompletion.addSkills', icon: <Award className="h-4 w-4" /> },
  hourly_rate: { label: 'profileCompletion.addHourlyRate', icon: <DollarSign className="h-4 w-4" /> },
  portfolio: { label: 'profileCompletion.addPortfolio', icon: <FolderOpen className="h-4 w-4" /> },
  payout_method: { label: 'profileCompletion.addPayoutMethod', icon: <DollarSign className="h-4 w-4" /> },
};

const companyMissingLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  logo_url: { label: 'profileCompletion.addLogo', icon: <Camera className="h-4 w-4" /> },
  company_name: { label: 'profileCompletion.addCompanyName', icon: <Building2 className="h-4 w-4" /> },
  website: { label: 'profileCompletion.addWebsite', icon: <Globe className="h-4 w-4" /> },
  company_size: { label: 'profileCompletion.addCompanySize', icon: <Users className="h-4 w-4" /> },
  about: { label: 'profileCompletion.addAbout', icon: <FileText className="h-4 w-4" /> },
  industry: { label: 'profileCompletion.addIndustry', icon: <Briefcase className="h-4 w-4" /> },
  location: { label: 'profileCompletion.addLocation', icon: <MapPin className="h-4 w-4" /> },
  country: { label: 'profileCompletion.addCountry', icon: <MapPin className="h-4 w-4" /> },
};

export function ProfileGateModal({
  open,
  onOpenChange,
  completionPercent,
  userType,
  missingItems = [],
}: ProfileGateModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const labels = userType === 'freelancer' ? freelancerMissingLabels : companyMissingLabels;

  const handleCompleteProfile = () => {
    onOpenChange(false);
    navigate("/settings?tab=profile");
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return 'bg-yellow-500';
    if (percent >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            {t('profileGate.title')}
          </DialogTitle>
          <DialogDescription>
            {userType === 'freelancer' 
              ? t('profileGate.freelancerDescription')
              : t('profileGate.companyDescription')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('profileGate.profileProgress')}</span>
              <Badge variant="outline" className={cn(
                "text-xs",
                completionPercent >= 80 ? "text-yellow-600 border-yellow-500" :
                completionPercent >= 50 ? "text-orange-600 border-orange-500" :
                "text-red-600 border-red-500"
              )}>
                {completionPercent}%
              </Badge>
            </div>
            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", getProgressColor(completionPercent))}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          {/* Bonus info */}
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">
              🎁 {t('profileGate.bonusHint')}
            </p>
          </div>

          {/* Missing items - show up to 4 */}
          {missingItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('profileGate.missingItems')}</p>
              <div className="grid grid-cols-2 gap-2">
                {missingItems.slice(0, 4).map((item) => {
                  const config = labels[item];
                  if (!config) return null;
                  return (
                    <div 
                      key={item}
                      className="flex items-center gap-2 p-2 bg-muted/30 rounded-md text-sm text-muted-foreground"
                    >
                      {config.icon}
                      <span className="truncate">{t(config.label)}</span>
                    </div>
                  );
                })}
              </div>
              {missingItems.length > 4 && (
                <p className="text-xs text-muted-foreground">
                  +{missingItems.length - 4} {t('profileGate.moreItems')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            {t('common.later')}
          </Button>
          <Button onClick={handleCompleteProfile} className="flex-1">
            {t('profileGate.completeNow')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
