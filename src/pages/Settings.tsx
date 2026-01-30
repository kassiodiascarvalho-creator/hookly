import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TieredAvatar } from "@/components/freelancer/TieredAvatar";
import { CompanyAvatar } from "@/components/company/CompanyAvatar";
import type { FreelancerTier } from "@/components/freelancer/TierBadge";
import { useCompanyPlanData } from "@/hooks/useCompanyPlanData";
import { useProfileCelebration } from "@/hooks/useProfileCelebration";
import { ProfileCelebrationModal } from "@/components/profile/ProfileCelebrationModal";
import { 
  computeFreelancerCompletion, 
  computeCompanyCompletion 
} from "@/lib/profileCompletion";
import { 
  User, Lock, Bell, CreditCard, Building, Briefcase, 
  Loader2, Save, Upload, Folder, Award, Wallet
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortfolioManager from "@/components/settings/PortfolioManager";
import CertificationsManager from "@/components/settings/CertificationsManager";
import { RestrictedCurrencySelect } from "@/components/RestrictedCurrencySelect";
import { FreelancerCreditsCard } from "@/components/billing/FreelancerCreditsCard";
import { FreelancerPlanCard } from "@/components/billing/FreelancerPlanCard";
import { CompanyWalletCard } from "@/components/billing/CompanyWalletCard";
import { CompanyPlanCard } from "@/components/billing/CompanyPlanCard";
import { CompanyBillingPanel } from "@/components/billing/CompanyBillingPanel";

interface Profile {
  email: string;
  preferred_language: string;
  user_type: "company" | "freelancer" | null;
  profile_completion_percent?: number | null;
}

interface CompanyProfile {
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  location: string | null;
  country: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  about: string | null;
  logo_url: string | null;
  document_type: "cpf" | "cnpj" | null;
  document_number: string | null;
}

interface FreelancerProfile {
  full_name: string | null;
  title: string | null;
  bio: string | null;
  hourly_rate: number | null;
  location: string | null;
  country?: string | null;
  skills: string[] | null;
  languages: string[] | null;
  avatar_url: string | null;
  preferred_payout_currency: string | null;
  tier?: FreelancerTier | null;
  document_type: "cpf" | "cnpj" | null;
  document_number: string | null;
}

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "profile";
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Check for success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success(t("billing.fundsAddedSuccess"));
    }
    if (searchParams.get("canceled") === "true") {
      toast.info(t("billing.paymentCanceled"));
    }
  }, [searchParams, t]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastCompletionPercent, setLastCompletionPercent] = useState<number>(0);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailProposals: true,
    emailMessages: true,
    emailPayments: true,
    emailMarketing: false,
  });

  // Fetch company plan for avatar ring + badge
  const { planInfo: companyPlanInfo } = useCompanyPlanData(
    profile?.user_type === "company" ? user?.id : undefined
  );

  // Profile celebration hook
  const { 
    showCelebration, 
    bonusCredits, 
    userType: celebrationUserType, 
    triggerCelebration, 
    closeCelebration 
  } = useProfileCelebration();

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  const fetchProfiles = async () => {
    if (!user) return;
    
    // Fetch main profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("email, preferred_language, user_type, profile_completion_percent")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setLastCompletionPercent(profileData.profile_completion_percent ?? 0);
      
      // Fetch type-specific profile
      if (profileData.user_type === "company") {
        const { data: companyData } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (companyData) {
          // Cast to any to access new columns not yet in generated types
          const data = companyData as any;
          setCompanyProfile({
            company_name: data.company_name,
            contact_name: data.contact_name,
            phone: data.phone,
            location: data.location,
            country: data.country,
            industry: data.industry,
            company_size: data.company_size,
            website: data.website,
            about: data.about,
            logo_url: data.logo_url,
            document_type: data.document_type || null,
            document_number: data.document_number || null,
          });
        }
      } else if (profileData.user_type === "freelancer") {
        const { data: freelancerData } = await supabase
          .from("freelancer_profiles")
          .select("*, tier")
          .eq("user_id", user.id)
          .single();
        if (freelancerData) {
          // Cast to any to access new columns not yet in generated types
          const data = freelancerData as any;
          setFreelancerProfile({
            full_name: data.full_name,
            title: data.title,
            bio: data.bio,
            hourly_rate: data.hourly_rate,
            location: data.location,
            country: data.country,
            skills: data.skills,
            languages: data.languages,
            avatar_url: data.avatar_url,
            preferred_payout_currency: data.preferred_payout_currency,
            tier: (data.tier as FreelancerTier) || "standard",
            document_type: data.document_type || null,
            document_number: data.document_number || null,
          });
        }
      }
    }
    
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);

    try {
      const previousCompletionPercent = lastCompletionPercent;

      // Update main profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ preferred_language: profile.preferred_language })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      let completionPercent = 0;

      // Update type-specific profile - only send editable fields
      if (profile.user_type === "company" && companyProfile) {
        const companyUpdateData = {
          company_name: companyProfile.company_name,
          contact_name: companyProfile.contact_name,
          phone: companyProfile.phone,
          location: companyProfile.location,
          country: companyProfile.country,
          industry: companyProfile.industry,
          company_size: companyProfile.company_size,
          website: companyProfile.website,
          about: companyProfile.about,
          logo_url: companyProfile.logo_url,
          document_type: companyProfile.document_type,
          document_number: companyProfile.document_number,
        };
        const { error } = await supabase
          .from("company_profiles")
          .update(companyUpdateData)
          .eq("user_id", user.id);
        if (error) throw error;

        // Calculate completion for company
        const completion = computeCompanyCompletion(companyProfile);
        completionPercent = completion.percent;

      } else if (profile.user_type === "freelancer" && freelancerProfile) {
        const freelancerUpdateData = {
          full_name: freelancerProfile.full_name,
          title: freelancerProfile.title,
          bio: freelancerProfile.bio,
          hourly_rate: freelancerProfile.hourly_rate,
          location: freelancerProfile.location,
          country: freelancerProfile.country,
          skills: freelancerProfile.skills,
          languages: freelancerProfile.languages,
          avatar_url: freelancerProfile.avatar_url,
          preferred_payout_currency: freelancerProfile.preferred_payout_currency,
          document_type: freelancerProfile.document_type,
          document_number: freelancerProfile.document_number,
        };
        const { error } = await supabase
          .from("freelancer_profiles")
          .update(freelancerUpdateData)
          .eq("user_id", user.id);
        if (error) throw error;

        // Check portfolio and payout methods for completion calculation
        const [portfolioResult, payoutResult] = await Promise.all([
          supabase
            .from("portfolio_items")
            .select("*", { count: "exact", head: true })
            .eq("freelancer_user_id", user.id),
          supabase
            .from("payout_methods")
            .select("*", { count: "exact", head: true })
            .eq("freelancer_user_id", user.id)
        ]);

        const hasPortfolio = (portfolioResult.count || 0) > 0;
        const hasPayout = (payoutResult.count || 0) > 0;
        
        // Calculate completion for freelancer
        const completion = computeFreelancerCompletion(freelancerProfile, hasPortfolio, hasPayout);
        completionPercent = completion.percent;
      }

      // Update completion percentage in profiles table
      await supabase
        .from("profiles")
        .update({
          profile_completion_percent: completionPercent,
          profile_completion_updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      toast.success(t("settings.saved"));

      // Trigger celebration ONLY when crossing the threshold (<100% -> 100%)
      const justCompleted = previousCompletionPercent < 100 && completionPercent >= 100;
      if (justCompleted && profile.user_type) {
        console.log("[SETTINGS] Profile is 100% complete, triggering celebration...");
        await triggerCelebration(completionPercent, profile.user_type);
      }

      // Keep local baseline up-to-date so the next save can detect transitions
      setLastCompletionPercent(completionPercent);

    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    
    if (newPassword.length < 8) {
      toast.error(t("auth.errors.weakPassword"));
      return;
    }

    setChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success(t("settings.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCompany = profile?.user_type === "company";

  return (
    <>
      {/* Profile Celebration Modal */}
      {showCelebration && celebrationUserType && (
        <ProfileCelebrationModal
          open={showCelebration}
          onClose={closeCelebration}
          bonusCredits={bonusCredits}
          userType={celebrationUserType}
        />
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
          <p className="text-muted-foreground">{t("settings.subtitle")}</p>
        </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className={`grid w-full ${!isCompany ? 'grid-cols-6' : 'grid-cols-4'} lg:w-auto lg:inline-grid`}>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.profile")}</span>
          </TabsTrigger>
          {!isCompany && (
            <>
              <TabsTrigger value="portfolio" className="gap-2">
                <Folder className="h-4 w-4" />
                <span className="hidden sm:inline">{t("settings.portfolio")}</span>
              </TabsTrigger>
              <TabsTrigger value="certifications" className="gap-2">
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">{t("settings.certifications")}</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.security")}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.notifications")}</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings.billing")}</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isCompany ? <Building className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                {isCompany ? t("settings.companyProfile") : t("settings.freelancerProfile")}
              </CardTitle>
              <CardDescription>{t("settings.profileDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar/Logo with FileUpload */}
              <div className="flex items-center gap-4">
                {isCompany ? (
                  <CompanyAvatar
                    logoUrl={companyProfile?.logo_url}
                    companyName={companyProfile?.company_name}
                    planType={companyPlanInfo?.plan_type || "free"}
                    size="xl"
                    showBadge={true}
                  />
                ) : (
                  <TieredAvatar
                    avatarUrl={freelancerProfile?.avatar_url}
                    name={freelancerProfile?.full_name}
                    tier={freelancerProfile?.tier || "standard"}
                    size="xl"
                    showBadge={true}
                  />
                )}
                <div>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !user) return;
                      
                      const bucket = isCompany ? "logos" : "avatars";
                      const fileExt = file.name.split(".").pop();
                      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
                      
                      const { error } = await supabase.storage
                        .from(bucket)
                        .upload(filePath, file, { upsert: true });
                      
                      if (error) {
                        toast.error(t("common.error"));
                        return;
                      }
                      
                      const { data: { publicUrl } } = supabase.storage
                        .from(bucket)
                        .getPublicUrl(filePath);
                      
                      if (isCompany && companyProfile) {
                        setCompanyProfile({ ...companyProfile, logo_url: publicUrl });
                      } else if (freelancerProfile) {
                        setFreelancerProfile({ ...freelancerProfile, avatar_url: publicUrl });
                      }
                      toast.success(t("uploads.success"));
                    }}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {t("settings.uploadPhoto")}
                  </Button>
                </div>
              </div>

              <Separator />

              {isCompany && companyProfile ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("settings.companyName")}</Label>
                    <Input
                      value={companyProfile.company_name || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.contactName")}</Label>
                    <Input
                      value={companyProfile.contact_name || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.phone")}</Label>
                    <Input
                      value={companyProfile.phone || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.location")}</Label>
                    <Input
                      value={companyProfile.location || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.industry")}</Label>
                    <Input
                      value={companyProfile.industry || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, industry: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.companySize")}</Label>
                    <Select
                      value={companyProfile.company_size || ""}
                      onValueChange={(value) => setCompanyProfile({ ...companyProfile, company_size: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectCompanySize")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 {t("settings.employee")}</SelectItem>
                        <SelectItem value="2-10">2-10 {t("settings.employees")}</SelectItem>
                        <SelectItem value="11-50">11-50 {t("settings.employees")}</SelectItem>
                        <SelectItem value="51-200">51-200 {t("settings.employees")}</SelectItem>
                        <SelectItem value="201-500">201-500 {t("settings.employees")}</SelectItem>
                        <SelectItem value="501-1000">501-1000 {t("settings.employees")}</SelectItem>
                        <SelectItem value="1000+">1000+ {t("settings.employees")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.country")}</Label>
                    <Select
                      value={companyProfile.country || ""}
                      onValueChange={(value) => setCompanyProfile({ ...companyProfile, country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectCountry")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BR">🇧🇷 Brasil</SelectItem>
                        <SelectItem value="US">🇺🇸 United States</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                        <SelectItem value="FR">🇫🇷 France</SelectItem>
                        <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                        <SelectItem value="PT">🇵🇹 Portugal</SelectItem>
                        <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                        <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                        <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                        <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                        <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                        <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                        <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                        <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                        <SelectItem value="CN">🇨🇳 China</SelectItem>
                        <SelectItem value="IN">🇮🇳 India</SelectItem>
                        <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                        <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                        <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.countryDesc")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.website")}</Label>
                    <Input
                      value={companyProfile.website || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, website: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.documentType")}</Label>
                    <Select
                      value={companyProfile.document_type || ""}
                      onValueChange={(value) => setCompanyProfile({ ...companyProfile, document_type: value as "cpf" | "cnpj" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectDocumentType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                        <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.documentNumber")}</Label>
                    <Input
                      value={companyProfile.document_number || ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setCompanyProfile({ ...companyProfile, document_number: value });
                      }}
                      placeholder={companyProfile.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                      maxLength={companyProfile.document_type === "cpf" ? 11 : 14}
                    />
                    <p className="text-xs text-muted-foreground">
                      {companyProfile.document_type === "cpf" ? t("settings.cpfDesc") : t("settings.cnpjDesc")}
                    </p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t("settings.about")}</Label>
                    <Textarea
                      value={companyProfile.about || ""}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, about: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              ) : freelancerProfile ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("settings.fullName")}</Label>
                    <Input
                      value={freelancerProfile.full_name || ""}
                      onChange={(e) => setFreelancerProfile({ ...freelancerProfile, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.professionalTitle")}</Label>
                    <Input
                      value={freelancerProfile.title || ""}
                      onChange={(e) => setFreelancerProfile({ ...freelancerProfile, title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.hourlyRate")}</Label>
                    <Input
                      type="number"
                      value={freelancerProfile.hourly_rate || ""}
                      onChange={(e) => setFreelancerProfile({ ...freelancerProfile, hourly_rate: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.location")}</Label>
                    <Input
                      value={freelancerProfile.location || ""}
                      onChange={(e) => setFreelancerProfile({ ...freelancerProfile, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.country")}</Label>
                    <Select
                      value={freelancerProfile.country || ""}
                      onValueChange={(value) => setFreelancerProfile({ ...freelancerProfile, country: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectCountry")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BR">🇧🇷 Brasil</SelectItem>
                        <SelectItem value="US">🇺🇸 United States</SelectItem>
                        <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                        <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                        <SelectItem value="FR">🇫🇷 France</SelectItem>
                        <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                        <SelectItem value="PT">🇵🇹 Portugal</SelectItem>
                        <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                        <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                        <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                        <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                        <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                        <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                        <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                        <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                        <SelectItem value="CN">🇨🇳 China</SelectItem>
                        <SelectItem value="IN">🇮🇳 India</SelectItem>
                        <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                        <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                        <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("settings.countryDesc")}</p>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t("settings.bio")}</Label>
                    <Textarea
                      value={freelancerProfile.bio || ""}
                      onChange={(e) => setFreelancerProfile({ ...freelancerProfile, bio: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{t("settings.skills")}</Label>
                    <Input
                      value={freelancerProfile.skills?.join(", ") || ""}
                      onChange={(e) => setFreelancerProfile({ 
                        ...freelancerProfile, 
                        skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder={t("settings.skillsPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.preferredPayoutCurrency")}</Label>
                    <RestrictedCurrencySelect
                      value={freelancerProfile.preferred_payout_currency || "USD"}
                      onValueChange={(v) => setFreelancerProfile({ ...freelancerProfile, preferred_payout_currency: v })}
                      countryCode={freelancerProfile.country}
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.preferredPayoutCurrencyDesc")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.documentType")}</Label>
                    <Select
                      value={freelancerProfile.document_type || ""}
                      onValueChange={(value) => setFreelancerProfile({ ...freelancerProfile, document_type: value as "cpf" | "cnpj" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.selectDocumentType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpf">CPF (Pessoa Física)</SelectItem>
                        <SelectItem value="cnpj">CNPJ (Pessoa Jurídica)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("settings.documentNumber")}</Label>
                    <Input
                      value={freelancerProfile.document_number || ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setFreelancerProfile({ ...freelancerProfile, document_number: value });
                      }}
                      placeholder={freelancerProfile.document_type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                      maxLength={freelancerProfile.document_type === "cpf" ? 11 : 14}
                    />
                    <p className="text-xs text-muted-foreground">
                      {freelancerProfile.document_type === "cpf" ? t("settings.cpfDesc") : t("settings.cnpjDesc")}
                    </p>
                  </div>
                </div>
              ) : null}

              <Separator />

              {/* Language Preference */}
              <div className="space-y-2">
                <Label>{t("settings.language")}</Label>
                <Select
                  value={profile?.preferred_language || "en"}
                  onValueChange={(value) => setProfile(profile ? { ...profile, preferred_language: value } : null)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portfolio Tab (Freelancers only) */}
        {!isCompany && (
          <TabsContent value="portfolio" className="space-y-6">
            <PortfolioManager />
          </TabsContent>
        )}

        {/* Certifications Tab (Freelancers only) */}
        {!isCompany && (
          <TabsContent value="certifications" className="space-y-6">
            <CertificationsManager />
          </TabsContent>
        )}

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.changePassword")}</CardTitle>
              <CardDescription>{t("settings.changePasswordDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("settings.newPassword")}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("settings.confirmPassword")}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleChangePassword} 
                disabled={changingPassword || !newPassword || !confirmPassword}
                className="gap-2"
              >
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {t("settings.updatePassword")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.emailNotifications")}</CardTitle>
              <CardDescription>{t("settings.emailNotificationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.proposalNotifications")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.proposalNotificationsDesc")}</p>
                </div>
                <Switch
                  checked={notifications.emailProposals}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, emailProposals: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.messageNotifications")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.messageNotificationsDesc")}</p>
                </div>
                <Switch
                  checked={notifications.emailMessages}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, emailMessages: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.paymentNotifications")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.paymentNotificationsDesc")}</p>
                </div>
                <Switch
                  checked={notifications.emailPayments}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, emailPayments: checked })}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t("settings.marketingEmails")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.marketingEmailsDesc")}</p>
                </div>
                <Switch
                  checked={notifications.emailMarketing}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, emailMarketing: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          {isCompany ? (
            <>
              <CompanyPlanCard />
              <CompanyWalletCard />
              <CompanyBillingPanel />
            </>
          ) : (
            <>
              <FreelancerPlanCard />
              <FreelancerCreditsCard />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}
