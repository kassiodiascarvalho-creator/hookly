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
  requireAdmin = false 
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      // Check email confirmation status from user metadata
      const isEmailConfirmed = !!user.email_confirmed_at;
      setEmailConfirmed(isEmailConfirmed);
      console.log("[GUARD] email confirmed:", isEmailConfirmed);

      try {
        // Check user type and onboarding status from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type, role, onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        setUserType(profile?.user_type || null);
        setOnboardingCompleted(profile?.onboarding_completed || false);
        
        // Check if admin using the has_role function
        const { data: hasAdminRole } = await supabase
          .rpc("has_role", { _user_id: user.id, _role: "admin" });
        
        // User is admin if they have the admin role in user_roles table OR role column is admin
        setIsAdmin(hasAdminRole === true || profile?.role === "admin");
        
        console.log("[GUARD] access check complete", { 
          user_type: profile?.user_type, 
          onboarding_completed: profile?.onboarding_completed,
          is_admin: hasAdminRole === true || profile?.role === "admin"
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

  // Email not confirmed - redirect to confirm step (except for admins checking)
  if (!emailConfirmed && !requireAdmin && location.pathname !== "/auth") {
    console.log("[GUARD] email not confirmed, redirecting to confirm step");
    return <Navigate to={`/auth?step=confirm-email&email=${encodeURIComponent(user.email || "")}`} replace />;
  }

  // Require admin but user is not admin
  if (requireAdmin && !isAdmin) {
    console.log("[GUARD] admin required but user is not admin");
    return <Navigate to="/" replace />;
  }

  // No user type yet OR onboarding not completed - redirect to onboarding 
  // (unless already there, admin route, or email not confirmed)
  if (
    emailConfirmed && 
    (!userType || !onboardingCompleted) && 
    location.pathname !== "/onboarding" && 
    !requireAdmin
  ) {
    console.log("[GUARD] no user_type or onboarding not completed, redirecting to /onboarding");
    return <Navigate to="/onboarding" replace />;
  }

  // Check allowed user types (skip for admin routes)
  if (allowedUserTypes && userType && !allowedUserTypes.includes(userType as "company" | "freelancer")) {
    console.log("[GUARD] user type not allowed, redirecting to dashboard");
    // Redirect to appropriate dashboard
    if (userType === "company") {
      return <Navigate to="/dashboard" replace />;
    } else if (userType === "freelancer") {
      return <Navigate to="/freelancer-dashboard" replace />;
    }
  }

  return <>{children}</>;
}
