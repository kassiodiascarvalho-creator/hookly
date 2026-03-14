import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: ("company" | "freelancer")[];
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  allowedUserTypes,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        // Check user type and onboarding status from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("user_id", user.id)
          .maybeSingle();

        setUserType(profile?.user_type || null);
        setOnboardingCompleted(true); // onboarding_completed column not in current schema

        // Check if admin using the has_role function (roles ficam APENAS na tabela user_roles)
        const { data: hasAdminRole } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        setIsAdmin(hasAdminRole === true);

        console.log("[GUARD] access check complete", {
          user_type: profile?.user_type,
          onboarding_completed: profile?.onboarding_completed,
          is_admin: hasAdminRole === true,
        });
      } catch (error) {
        console.error("[GUARD] Error checking access:", error);
      } finally {
        setChecking(false);
      }
    };

    if (!authLoading) {
      checkAccess();
    }
  }, [user, authLoading, requireAdmin]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    console.log("[GUARD] no user, redirecting to /auth");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Require admin but user is not admin
  if (requireAdmin && !isAdmin) {
    console.log("[GUARD] admin required but user is not admin");
    return <Navigate to="/" replace />;
  }

  // No user type yet OR onboarding not completed - redirect to onboarding
  if (!userType || !onboardingCompleted) {
    if (location.pathname !== "/onboarding" && !requireAdmin) {
      console.log("[GUARD] no user_type or onboarding not completed, redirecting to /onboarding");
      return <Navigate to="/onboarding" replace />;
    }
  }

  // Check allowed user types (skip for admin routes)
  if (allowedUserTypes && userType && !allowedUserTypes.includes(userType as "company" | "freelancer")) {
    console.log("[GUARD] user type not allowed, redirecting to dashboard");
    if (userType === "company") {
      return <Navigate to="/dashboard" replace />;
    }
    if (userType === "freelancer") {
      return <Navigate to="/freelancer-dashboard" replace />;
    }
  }

  return <>{children}</>;
}

