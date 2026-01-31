import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export const Comparison = () => {
  const { t } = useTranslation();

  const features = [
    { featureKey: "escrowProtection", us: true, others: false },
    { featureKey: "noHiddenFees", us: true, others: false },
    { featureKey: "multiCurrency", us: true, others: false },
    { featureKey: "verifiedTalent", us: true, others: true },
    { featureKey: "resultsBased", us: true, others: false },
    { featureKey: "integration", us: true, others: true },
  ];

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("comparison.title")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("comparison.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 font-semibold">
              <div>{t("comparison.feature")}</div>
              <div className="text-center text-primary">{t("comparison.hookly")}</div>
              <div className="text-center text-muted-foreground">{t("comparison.others")}</div>
            </div>
            {features.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 p-4 border-t border-border">
                <div className="text-sm">{t(`comparison.features.${item.featureKey}`)}</div>
                <div className="flex justify-center">
                  {item.us ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex justify-center">
                  {item.others ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <X className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};