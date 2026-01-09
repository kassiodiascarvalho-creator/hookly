import { useState } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Comparison } from "@/components/landing/Comparison";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { SignupModal } from "@/components/landing/SignupModal";

const Index = () => {
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupType, setSignupType] = useState<"company" | "freelancer">("company");

  const handleOpenSignup = (type: "company" | "freelancer") => {
    setSignupType(type);
    setIsSignupOpen(true);
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background">
        <Navbar onOpenSignup={handleOpenSignup} />
        <Hero onOpenSignup={handleOpenSignup} />
        <HowItWorks />
        <Comparison />
        <Testimonials />
        <FAQ />
        <CTASection onOpenSignup={handleOpenSignup} />
        <Footer />
        <SignupModal isOpen={isSignupOpen} onClose={() => setIsSignupOpen(false)} type={signupType} />
      </div>
    </LanguageProvider>
  );
};

export default Index;
