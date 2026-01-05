import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export default function Pricing() {
  const { t } = useTranslation();

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
              {t("pricingPage.title")}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
              {t("pricingPage.subtitle")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl p-8 shadow-card border"
            >
              <h3 className="font-display text-xl font-semibold mb-2">{t("pricing.starter.name")}</h3>
              <div className="text-4xl font-bold mb-4">{t("pricing.starter.price")}</div>
              <p className="text-muted-foreground text-sm mb-6">{t("pricing.starter.description")}</p>
              <ul className="space-y-3 mb-8">
                {(t("pricing.starter.features", { returnObjects: true }) as string[]).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button variant="outline" className="w-full">{t("pricing.starter.cta")}</Button>
              </Link>
            </motion.div>

            {/* Business */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-secondary text-secondary-foreground rounded-2xl p-8 relative"
            >
              <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                {t("pricing.business.popular")}
              </span>
              <h3 className="font-display text-xl font-semibold mb-2">{t("pricing.business.name")}</h3>
              <div className="text-4xl font-bold mb-4">{t("pricing.business.price")}</div>
              <p className="text-secondary-foreground/80 text-sm mb-6">{t("pricing.business.description")}</p>
              <ul className="space-y-3 mb-8">
                {(t("pricing.business.features", { returnObjects: true }) as string[]).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button className="w-full">{t("pricing.business.cta")}</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold mb-4">{t("pricingPage.faqTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("pricingPage.faqSubtitle")}</p>
          <div className="max-w-2xl mx-auto text-left space-y-4">
            <div className="bg-card p-4 rounded-lg">
              <h3 className="font-semibold mb-2">{t("pricingPage.faq.fees.question")}</h3>
              <p className="text-muted-foreground text-sm">{t("pricingPage.faq.fees.answer")}</p>
            </div>
            <div className="bg-card p-4 rounded-lg">
              <h3 className="font-semibold mb-2">{t("pricingPage.faq.payment.question")}</h3>
              <p className="text-muted-foreground text-sm">{t("pricingPage.faq.payment.answer")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-hero text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">{t("pricingPage.ctaTitle")}</h2>
          <p className="text-secondary-foreground/80 mb-8">{t("pricingPage.ctaSubtitle")}</p>
          <Link to="/auth">
            <Button size="lg">{t("pricingPage.ctaButton")}</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
