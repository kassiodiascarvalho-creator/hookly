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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, Lock, Bell, CreditCard, Building, Briefcase, 
  Loader2, Save, Upload, Folder, Award, Wallet
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortfolioManager from "@/components/settings/PortfolioManager";
import CertificationsManager from "@/components/settings/CertificationsManager";
import { CurrencySelect } from "@/components/CurrencySelect";
import { FreelancerCreditsCard } from "@/components/billing/FreelancerCreditsCard";
import { CompanyWalletCard } from "@/components/billing/CompanyWalletCard";

interface Profile {
  email: string;
  preferred_language: string;
  user_type: "company" | "freelancer" | null;
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
      .select("email, preferred_language, user_type")
      .eq("user_id", user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      
      // Fetch type-specific profile
      if (profileData.user_type === "company") {
        const { data: companyData } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (companyData) {
          setCompanyProfile(companyData);
        }
      } else if (profileData.user_type === "freelancer") {
        const { data: freelancerData } = await supabase
          .from("freelancer_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (freelancerData) {
          setFreelancerProfile(freelancerData);
        }
      }
    }
    
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setSaving(true);

    try {
      // Update main profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ preferred_language: profile.preferred_language })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Update type-specific profile
      if (profile.user_type === "company" && companyProfile) {
        const { error } = await supabase
          .from("company_profiles")
          .update(companyProfile)
          .eq("user_id", user.id);
        if (error) throw error;
      } else if (profile.user_type === "freelancer" && freelancerProfile) {
        const { error } = await supabase
          .from("freelancer_profiles")
          .update(freelancerProfile)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      toast.success(t("settings.saved"));
    } catch (error) {
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
                <Avatar className="h-20 w-20">
                  <AvatarImage src={isCompany ? companyProfile?.logo_url || undefined : freelancerProfile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl">
                    {isCompany 
                      ? companyProfile?.company_name?.charAt(0) || "C"
                      : freelancerProfile?.full_name?.charAt(0) || "F"
                    }
                  </AvatarFallback>
                </Avatar>
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
                    <CurrencySelect
                      value={freelancerProfile.preferred_payout_currency || "USD"}
                      onValueChange={(v) => setFreelancerProfile({ ...freelancerProfile, preferred_payout_currency: v })}
                      className="w-48"
                    />
                    <p className="text-xs text-muted-foreground">{t("settings.preferredPayoutCurrencyDesc")}</p>
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
          {isCompany ? <CompanyWalletCard /> : <FreelancerCreditsCard />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
