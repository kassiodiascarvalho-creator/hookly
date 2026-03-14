import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { 
  FileText, Users, CheckCircle, DollarSign, ArrowRight, Shield
} from "lucide-react";

export default function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: FileText,
      title: t("howItWorksPage.steps.post.title"),
      description: t("howItWorksPage.steps.post.description"),
    },
    {
      icon: Users,
      title: t("howItWorksPage.steps.match.title"),
      description: t("howItWorksPage.steps.match.description"),
    },
    {
      icon: CheckCircle,
      title: t("howItWorksPage.steps.work.title"),
      description: t("howItWorksPage.steps.work.description"),
    },
    {
      icon: DollarSign,
      title: t("howItWorksPage.steps.pay.title"),
      description: t("howItWorksPage.steps.pay.description"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">{t("nav.login")}</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">{t("nav.signup")}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-display text-4xl lg:text-5xl font-bold mb-6">
              {t("howItWorksPage.title")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("howItWorksPage.subtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Steps */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-6 mb-12"
              >
                <div className="shrink-0">
                  <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <step.icon className="h-8 w-8" />
                  </div>
                </div>
                <div className="pt-2">
                  <div className="text-sm text-muted-foreground mb-1">{t("howItWorksPage.step")} {i + 1}</div>
                  <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-4">{t("howItWorksPage.security.title")}</h2>
            <p className="text-muted-foreground">{t("howItWorksPage.security.description")}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-hero text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">{t("howItWorksPage.ctaTitle")}</h2>
          <p className="text-secondary-foreground/80 mb-8">{t("howItWorksPage.ctaSubtitle")}</p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              {t("howItWorksPage.ctaButton")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
