import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, Zap } from "lucide-react";

interface HeroProps {
  onOpenSignup: (type: "company" | "freelancer") => void;
}

export const Hero = ({ onOpenSignup }: HeroProps) => {
  const { t } = useTranslation();

  return (
    <section className="pt-32 pb-20 px-4">
      <div className="container mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t("hero.title")} {t("hero.titleLine2")}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <Button size="lg" onClick={() => onOpenSignup("company")} className="gap-2">
            {t("hero.cta")} <ArrowRight className="w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => onOpenSignup("freelancer")}>
            {t("hero.ctaSecondary")}
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
        >
          <div className="bg-card p-6 rounded-xl border border-border">
            <Shield className="w-10 h-10 text-primary mb-4 mx-auto" />
            <h3 className="font-semibold mb-2">{t("whyHookly.features.escrowTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("whyHookly.features.escrowDesc")}</p>
          </div>
          <div className="bg-card p-6 rounded-xl border border-border">
            <Users className="w-10 h-10 text-primary mb-4 mx-auto" />
            <h3 className="font-semibold mb-2">{t("whyHookly.features.verified.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("whyHookly.features.verified.description")}</p>
          </div>
          <div className="bg-card p-6 rounded-xl border border-border">
            <Zap className="w-10 h-10 text-primary mb-4 mx-auto" />
            <h3 className="font-semibold mb-2">{t("whyHookly.features.matchingTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("whyHookly.features.matchingDesc")}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};