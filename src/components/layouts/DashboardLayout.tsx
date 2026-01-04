import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  FileText,
  Award,
  ChevronLeft,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
  { code: "de", label: "Deutsch" },
];

export function DashboardLayout() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userType, setUserType] = useState<"company" | "freelancer" | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_type, preferred_language")
      .eq("user_id", user.id)
      .single();
    
    if (profileData) {
      setUserType(profileData.user_type as "company" | "freelancer");
      if (profileData.preferred_language && profileData.preferred_language !== i18n.language) {
        i18n.changeLanguage(profileData.preferred_language);
      }
    }

    // Fetch specific profile
    if (profileData?.user_type === "company") {
      const { data } = await supabase
        .from("company_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setProfile(data);
    } else if (profileData?.user_type === "freelancer") {
      const { data } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setProfile(data);
    }
  };

  const handleLanguageChange = async (lang: string) => {
    i18n.changeLanguage(lang);
    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: lang })
        .eq("user_id", user.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const companyNavItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
    { icon: Briefcase, label: t("nav.projects"), path: "/projects" },
    { icon: FileText, label: t("nav.proposals"), path: "/proposals" },
    { icon: Users, label: t("nav.talentPool"), path: "/talent-pool" },
    { icon: MessageSquare, label: t("nav.messages"), path: "/messages" },
    { icon: DollarSign, label: t("nav.finances"), path: "/finances" },
    { icon: Settings, label: t("nav.settings"), path: "/settings" },
  ];

  const freelancerNavItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/freelancer-dashboard" },
    { icon: Search, label: t("nav.findProjects"), path: "/find-projects" },
    { icon: FileText, label: t("nav.myProposals"), path: "/my-proposals" },
    { icon: MessageSquare, label: t("nav.messages"), path: "/messages" },
    { icon: DollarSign, label: t("nav.earnings"), path: "/earnings" },
    { icon: Award, label: t("nav.certifications"), path: "/certifications" },
    { icon: Settings, label: t("nav.settings"), path: "/settings" },
  ];

  const navItems = userType === "company" ? companyNavItems : freelancerNavItems;

  const displayName = userType === "company" 
    ? profile?.company_name || profile?.contact_name || user?.email
    : profile?.full_name || user?.email;

  const avatarUrl = userType === "company" ? profile?.logo_url : profile?.avatar_url;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          {sidebarOpen ? (
            <Logo onClick={() => navigate("/")} className="cursor-pointer" />
          ) : (
            <img
              src="https://i.imgur.com/0XQ4UGj.png"
              alt="HOOKLY"
              className="h-8 w-8 cursor-pointer"
              onClick={() => navigate("/")}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                !sidebarOpen && "justify-center px-2"
              )}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-border">
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-300",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Logo onClick={() => navigate("/")} className="cursor-pointer" />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false);
              }}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {displayName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline-block max-w-[120px] truncate">
                    {displayName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t("nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
