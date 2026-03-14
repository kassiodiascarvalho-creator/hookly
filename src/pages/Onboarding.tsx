import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Building2, User, Loader2, ArrowRight, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<"company" | "freelancer" | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    // Check if user already has a type and completed onboarding
    const checkExistingProfile = async () => {
      if (!user) {
        setCheckingExisting(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, onboarding_completed")
        .eq("user_id", user.id)
        .single();

      if (profile?.user_type && profile?.onboarding_completed) {
        console.log("[ONBOARDING] user already completed onboarding, redirecting");
        if (profile.user_type === "company") {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/freelancer-dashboard", { replace: true });
        }
      }
      setCheckingExisting(false);
    };

    checkExistingProfile();
  }, [user, navigate]);

  const handleSelectType = async (type: "company" | "freelancer") => {
    if (!user) {
      toast.error(t("auth.mustBeLoggedIn"));
      navigate("/auth");
      return;
    }

    setLoading(type);
    console.log("[ONBOARDING] selecting type", { type, user_id: user.id });

    try {
      // Update user type and mark onboarding as completed
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({ 
          user_type: type,
          onboarding_completed: true,
          profile_completion_percent: 0,
          profile_completion_updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // Create the appropriate profile using upsert for idempotency
      if (type === "company") {
        const { error: companyError } = await supabase
          .from("company_profiles")
          .upsert(
            { user_id: user.id },
            { onConflict: "user_id" }
          );
        
        if (companyError) {
          throw companyError;
        }
        
        console.log("[ONBOARDING] profile created", { user_type: "company", user_id: user.id });
        toast.success(t("onboarding.companyCreated"));
        navigate("/dashboard", { replace: true });
      } else {
        const { error: freelancerError } = await supabase
          .from("freelancer_profiles")
          .upsert(
            { user_id: user.id, proposal_credits: 3 },
            { onConflict: "user_id" }
          );
        
        if (freelancerError) {
          throw freelancerError;
        }

        // Initialize achievements for freelancer
        try {
          await supabase.rpc("initialize_freelancer_achievements", {
            p_freelancer_user_id: user.id
          });
        } catch (e) {
          console.log("[ONBOARDING] achievements init skipped (may already exist)");
        }
        
        console.log("[ONBOARDING] profile created", { user_type: "freelancer", user_id: user.id });
        toast.success(t("onboarding.freelancerCreated"));
        navigate("/freelancer-dashboard", { replace: true });
      }
    } catch (error: any) {
      console.error("[ONBOARDING] error:", error);
      toast.error(error.message || t("common.error"));
    } finally {
      setLoading(null);
    }
  };

  const features = {
    company: [
      t("onboarding.companyFeature1"),
      t("onboarding.companyFeature2"),
      t("onboarding.companyFeature3"),
    ],
    freelancer: [
      t("onboarding.freelancerFeature1"),
      t("onboarding.freelancerFeature2"),
      t("onboarding.freelancerFeature3"),
    ],
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center mb-8">
          <Logo size="lg" onClick={() => navigate("/")} className="cursor-pointer" />
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t("onboarding.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {t("onboarding.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Company Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className={`cursor-pointer border-2 transition-all duration-300 h-full ${
                loading === "company"
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/50 hover:shadow-lg"
              }`}
              onClick={() => !loading && handleSelectType("company")}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {loading === "company" ? (
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  ) : (
                    <Building2 className="h-8 w-8 text-primary" />
                  )}
                </div>
                <CardTitle className="text-xl">{t("onboarding.companyTitle")}</CardTitle>
                <CardDescription className="text-base">
                  {t("onboarding.companyDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.company.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center justify-center text-primary font-medium">
                  {t("onboarding.getStarted")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Freelancer Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <Card
              className={`cursor-pointer border-2 transition-all duration-300 h-full ${
                loading === "freelancer"
                  ? "border-secondary bg-secondary/5"
                  : "border-border/50 hover:border-secondary/50 hover:shadow-lg"
              }`}
              onClick={() => !loading && handleSelectType("freelancer")}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {loading === "freelancer" ? (
                    <Loader2 className="h-8 w-8 text-secondary animate-spin" />
                  ) : (
                    <User className="h-8 w-8 text-secondary" />
                  )}
                </div>
                <CardTitle className="text-xl">{t("onboarding.freelancerTitle")}</CardTitle>
                <CardDescription className="text-base">
                  {t("onboarding.freelancerDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {features.freelancer.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center justify-center text-secondary font-medium">
                  {t("onboarding.getStarted")}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
