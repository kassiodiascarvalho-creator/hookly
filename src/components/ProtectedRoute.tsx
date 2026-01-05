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

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        // Check user type from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type, role")
          .eq("user_id", user.id)
          .maybeSingle();

        setUserType(profile?.user_type || null);
        
        // Check if admin using the has_role function
        const { data: hasAdminRole } = await supabase
          .rpc("has_role", { _user_id: user.id, _role: "admin" });
        
        // User is admin if they have the admin role in user_roles table OR role column is admin
        setIsAdmin(hasAdminRole === true || profile?.role === "admin");
      } catch (error) {
        console.error("Error checking access:", error);
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
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Require admin but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // No user type yet - redirect to onboarding (unless already there or admin route)
  if (!userType && location.pathname !== "/onboarding" && !requireAdmin) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check allowed user types (skip for admin routes)
  if (allowedUserTypes && userType && !allowedUserTypes.includes(userType as "company" | "freelancer")) {
    // Redirect to appropriate dashboard
    if (userType === "company") {
      return <Navigate to="/dashboard" replace />;
    } else if (userType === "freelancer") {
      return <Navigate to="/freelancer-dashboard" replace />;
    }
  }

  return <>{children}</>;
}
