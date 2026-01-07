import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderOpen,
  CreditCard,
  Mail,
  LogOut,
  UserCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

const navItems = [
  { path: "/admin", icon: LayoutDashboard, labelKey: "admin.dashboard" },
  { path: "/admin/users", icon: Users, labelKey: "admin.users" },
  { path: "/admin/freelancers", icon: UserCheck, labelKey: "admin.freelancers" },
  { path: "/admin/companies", icon: Building2, labelKey: "admin.companies" },
  { path: "/admin/projects", icon: FolderOpen, labelKey: "admin.projects" },
  { path: "/admin/payments", icon: CreditCard, labelKey: "admin.payments" },
  { path: "/admin/finances", icon: Wallet, labelKey: "admin.finances" },
  { path: "/admin/payment-providers", icon: CreditCard, labelKey: "admin.paymentProviders" },
  { path: "/admin/leads", icon: Mail, labelKey: "admin.leads" },
];

interface AdminLayoutProps {
  children?: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Logo />
          <div className="mt-2 px-2 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded">
            {t("admin.adminPanel")}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
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
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
