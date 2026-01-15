import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Mail, ArrowLeft, RefreshCw, Check, X } from "lucide-react";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const emailSchema = z.string().trim().email("Invalid email address").max(255);

const PASSWORD_MAX_LEN = 72;
const loginPasswordSchema = z.string().min(1).max(PASSWORD_MAX_LEN);
const signupPasswordSchema = z
  .string()
  .min(8)
  .max(PASSWORD_MAX_LEN)
  .refine((v) => /[A-Za-z]/.test(v))
  .refine((v) => /\d/.test(v))
  .refine((v) => /[^A-Za-z0-9]/.test(v));

type AuthStep = "credentials" | "verify-email";

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [step, setStep] = useState<AuthStep>(
    searchParams.get("step") === "confirm-email" ? "verify-email" : "credentials"
  );
  const [activeTab, setActiveTab] = useState<"login" | "signup">(
    searchParams.get("tab") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpCode, setOtpCode] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string; otp?: string }>({});

  const passwordChecks = {
    minLength: password.length >= 8,
    letter: /[A-Za-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const isStrongPassword = Object.values(passwordChecks).every(Boolean);
  const isEmailValid = emailSchema.safeParse(email).success;
  const isSignupReady =
    activeTab === "signup" &&
    isEmailValid &&
    isStrongPassword &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  useEffect(() => {
    if (!authLoading && user) {
      // Check if email is confirmed
      if (!user.email_confirmed_at) {
        console.log("[AUTH] user not email confirmed, showing verify step");
        setEmail(user.email || "");
        setStep("verify-email");
        return;
      }
      checkUserTypeAndRedirect();
    }
  }, [user, authLoading]);

  // Start resend cooldown whenever we enter the verify-email step
  useEffect(() => {
    if (step === "verify-email") {
      setResendCooldown(60);
    } else {
      setResendCooldown(0);
    }
  }, [step]);

  // Countdown for resend cooldown
  useEffect(() => {
    if (step !== "verify-email" || resendCooldown <= 0) return;

    const interval = window.setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [step, resendCooldown]);

  const checkUserTypeAndRedirect = async () => {
    if (!user) return;
    
    console.log("[AUTH] checking user type for redirect", { user_id: user.id });
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type, onboarding_completed")
      .eq("user_id", user.id)
      .single();
    
    if (!profile?.user_type || !profile?.onboarding_completed) {
      console.log("[AUTH] redirecting to onboarding - no user_type or onboarding not completed");
      navigate("/onboarding");
    } else if (profile?.user_type === "company") {
      navigate("/dashboard");
    } else if (profile?.user_type === "freelancer") {
      navigate("/freelancer-dashboard");
    } else {
      navigate("/onboarding");
    }
  };

  const validateForm = (isSignup: boolean): boolean => {
    const newErrors: typeof errors = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    try {
      (isSignup ? signupPasswordSchema : loginPasswordSchema).parse(password);
    } catch {
      newErrors.password = isSignup
        ? t("auth.errors.weakPassword")
        : t("auth.errors.invalidCredentials");
    }

    if (isSignup && password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setLoading(true);
    console.log("[AUTH] attempting login", { email });
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.log("[AUTH] login error", { error: error.message });
      if (error.message.includes("Invalid login credentials")) {
        toast.error(t("auth.invalidCredentials"));
      } else if (error.message.includes("Email not confirmed")) {
        toast.error(t("auth.emailNotConfirmed"));
        setStep("verify-email");
      } else {
        toast.error(error.message);
      }
    } else {
      console.log("[AUTH] login success", { user_id: data.user?.id });
      toast.success(t("auth.loginSuccess"));
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setLoading(true);
    console.log("[AUTH] signup created", { email });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      console.log("[AUTH] signup error", { error: error.message });
      if (error.message.includes("already registered")) {
        toast.error(t("auth.emailAlreadyRegistered"));
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }
    
    console.log("[AUTH] signup success, moving to verify step");
    toast.success(t("auth.verificationCodeSent"));
    setStep("verify-email");
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: t("auth.invalidCode") });
      return;
    }
    
    setLoading(true);
    setErrors({});
    console.log("[AUTH] verifying OTP", { email });
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: "signup",
    });
    
    if (error) {
      console.log("[AUTH] OTP verification error", { error: error.message });
      setErrors({ otp: t("auth.invalidOrExpiredCode") });
      toast.error(t("auth.invalidOrExpiredCode"));
      setLoading(false);
      return;
    }
    
    console.log("[AUTH] otp verified", { user_id: data.user?.id });
    toast.success(t("auth.emailVerified"));
    
    // Redirect to onboarding
    navigate("/onboarding");
    setLoading(false);
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setResending(true);
    console.log("[AUTH] resending verification code", { email });

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      console.log("[AUTH] resend error", { error: error.message });
      toast.error(error.message);
    } else {
      toast.success(t("auth.codeSentAgain"));
      setResendCooldown(60);
    }
    setResending(false);
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setOtpCode("");
    setErrors({});
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Email Verification Step
  if (step === "verify-email") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Logo size="lg" onClick={() => navigate("/")} className="cursor-pointer" />
          </div>
          
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">
                {t("auth.confirmEmail")}
              </CardTitle>
              <CardDescription className="space-y-2">
                <p>{t("auth.codeSentTo")}</p>
                <p className="font-medium text-foreground">{email}</p>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-center block">{t("auth.enterCode")}</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => {
                      setOtpCode(value);
                      setErrors({});
                    }}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {errors.otp && (
                  <p className="text-sm text-destructive text-center">{errors.otp}</p>
                )}
              </div>
              
              <Button 
                onClick={handleVerifyOtp} 
                className="w-full" 
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("auth.verifyEmail")}
              </Button>
              
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  className="w-full gap-2"
                  onClick={handleResendCode}
                  disabled={resending || resendCooldown > 0}
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {resendCooldown > 0
                    ? t("auth.resendCodeIn", { seconds: resendCooldown })
                    : t("auth.resendCode")}
                </Button>
                
                <Button
                  variant="link"
                  className="w-full gap-2"
                  onClick={handleBackToCredentials}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("auth.backToLogin")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" onClick={() => navigate("/")} className="cursor-pointer" />
        </div>
        
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {activeTab === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}
            </CardTitle>
            <CardDescription>
              {activeTab === "login" ? t("auth.loginSubtitle") : t("auth.signupSubtitle")}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signup")}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("auth.email")}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="login-password">{t("auth.password")}</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="p-0 h-auto text-sm text-muted-foreground"
                        onClick={() => navigate("/reset-password")}
                      >
                        {t("auth.forgotPassword")}
                      </Button>
                    </div>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={errors.password ? "border-destructive pr-10" : "pr-10"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t("auth.login")}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("auth.email")}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={errors.password ? "border-destructive pr-10" : "pr-10"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("auth.passwordRequirementsIntro")}
                      </p>
                      <ul className="space-y-1 text-xs">
                        <li className="flex items-center gap-2">
                          {passwordChecks.minLength ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{t("auth.passwordRuleMinLength")}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {passwordChecks.letter ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{t("auth.passwordRuleLetter")}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {passwordChecks.number ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{t("auth.passwordRuleNumber")}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {passwordChecks.special ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span>{t("auth.passwordRuleSpecial")}</span>
                        </li>
                      </ul>
                    </div>

                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={errors.confirmPassword ? "border-destructive" : ""}
                    />
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading || !isSignupReady}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t("auth.createAccount")}
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    {t("auth.termsNotice")}
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
