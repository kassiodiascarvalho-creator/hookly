import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderOpen,
  CreditCard,
  LogOut,
  UserCheck,
  Wallet,
  Menu,
  Star,
  Layout,
  Shield,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode, useState, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  path: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  ownerOnly?: boolean;
  permissionKey?: string;
}

const navItems: NavItem[] = [
  { path: "/admin", icon: LayoutDashboard, labelKey: "admin.dashboard" },
  { path: "/admin/users", icon: Users, labelKey: "admin.users", permissionKey: "can_manage_users" },
  { path: "/admin/freelancers", icon: UserCheck, labelKey: "admin.freelancers", permissionKey: "can_manage_freelancers" },
  { path: "/admin/companies", icon: Building2, labelKey: "admin.companies", permissionKey: "can_manage_companies" },
  { path: "/admin/projects", icon: FolderOpen, labelKey: "admin.projects", permissionKey: "can_manage_projects" },
  { path: "/admin/payments", icon: CreditCard, labelKey: "admin.payments", permissionKey: "can_manage_payments" },
  { path: "/admin/finances", icon: Wallet, labelKey: "admin.finances", permissionKey: "can_manage_finances" },
  { path: "/admin/tiers", icon: Star, labelKey: "admin.tiers", permissionKey: "can_manage_tiers" },
  { path: "/admin/payment-providers", icon: CreditCard, labelKey: "admin.paymentProviders", permissionKey: "can_manage_payment_providers" },
  { path: "/admin/landing-page", icon: Layout, labelKey: "admin.landingPage", permissionKey: "can_manage_landing_page" },
  { path: "/admin/management", icon: Shield, labelKey: "admin.adminManagement", ownerOnly: true },
];

interface AdminLayoutProps {
  children?: ReactNode;
}

// Get page title based on current path
function getPageTitle(pathname: string, t: (key: string) => string): string {
  const item = navItems.find((item) => {
    if (item.path === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(item.path);
  });
  return item ? t(item.labelKey) : t("admin.adminPanel");
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isOwner, hasPermission, loading: permLoading } = useAdminPermissions();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pageTitle = getPageTitle(location.pathname, t);

  // Filter nav items based on permissions
  const filteredNavItems = useMemo(() => {
    // If still loading permissions, show all items (will be filtered once loaded)
    if (permLoading) return navItems;

    return navItems.filter((item) => {
      // Owner sees everything
      if (isOwner) return true;
      
      // Owner-only items are hidden for non-owners
      if (item.ownerOnly) return false;
      
      // Dashboard is always visible
      if (item.path === "/admin") return true;
      
      // Check specific permission
      if (item.permissionKey) {
        return hasPermission(item.permissionKey as any);
      }
      
      return true;
    });
  }, [isOwner, permLoading, hasPermission]);

  // Sidebar content - shared between desktop and mobile
  const SidebarContent = () => (
    <>
      <div className="p-4 border-b">
        <Logo />
        <div className="mt-2 px-2 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded flex items-center gap-1">
          {isOwner && <Crown className="h-3 w-3" />}
          {t("admin.adminPanel")}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                item.ownerOnly && "text-yellow-600 dark:text-yellow-500"
              )
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {t("common.signOut")}
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Mobile Header - only visible on mobile */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b bg-card">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 flex flex-col">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        
        <h1 className="text-base font-semibold truncate">{pageTitle}</h1>
        
        {/* Empty div for flex spacing */}
        <div className="w-9" />
      </header>

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex w-64 border-r bg-card flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
