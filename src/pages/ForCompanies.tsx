import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { 
  Shield, Users, DollarSign, Clock, CheckCircle, ArrowRight,
  Briefcase, Award, Globe, Zap
} from "lucide-react";

export default function ForCompanies() {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Shield,
      title: t("forCompanies.benefits.verified.title"),
      description: t("forCompanies.benefits.verified.description"),
    },
    {
      icon: DollarSign,
      title: t("forCompanies.benefits.escrow.title"),
      description: t("forCompanies.benefits.escrow.description"),
    },
    {
      icon: Users,
      title: t("forCompanies.benefits.talent.title"),
      description: t("forCompanies.benefits.talent.description"),
    },
    {
      icon: Clock,
      title: t("forCompanies.benefits.fast.title"),
      description: t("forCompanies.benefits.fast.description"),
    },
  ];

  const steps = [
    { title: t("forCompanies.steps.post.title"), desc: t("forCompanies.steps.post.description") },
    { title: t("forCompanies.steps.receive.title"), desc: t("forCompanies.steps.receive.description") },
    { title: t("forCompanies.steps.hire.title"), desc: t("forCompanies.steps.hire.description") },
    { title: t("forCompanies.steps.pay.title"), desc: t("forCompanies.steps.pay.description") },
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
      <section className="bg-hero text-secondary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6">
              <Briefcase className="h-4 w-4 mr-2" />
              {t("forCompanies.badge")}
            </Badge>
            <h1 className="font-display text-4xl lg:text-5xl font-bold mb-6">
              {t("forCompanies.title")}
            </h1>
            <p className="text-lg text-secondary-foreground/80 max-w-2xl mx-auto mb-8">
              {t("forCompanies.subtitle")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  {t("forCompanies.cta")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/talent-pool">
                <Button size="lg" variant="outline" className="bg-transparent border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10">
                  {t("forCompanies.ctaSecondary")}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            {t("forCompanies.benefitsTitle")}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold text-center mb-12">
            {t("forCompanies.howItWorks")}
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-hero text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">{t("forCompanies.ctaTitle")}</h2>
          <p className="text-secondary-foreground/80 mb-8 max-w-xl mx-auto">
            {t("forCompanies.ctaSubtitle")}
          </p>
          <Link to="/auth">
            <Button size="lg">{t("forCompanies.ctaButton")}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center bg-primary/20 text-primary px-4 py-2 rounded-full text-sm font-medium ${className}`}>
      {children}
    </span>
  );
}
