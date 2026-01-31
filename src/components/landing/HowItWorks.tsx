import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileText, Search, MessageSquare, CheckCircle } from "lucide-react";

export const HowItWorks = () => {
  const { t } = useTranslation();

  const steps = [
    {
      icon: FileText,
      title: t("howItWorks.steps.post.title"),
      description: t("howItWorks.steps.post.description")
    },
    {
      icon: Search,
      title: t("howItWorks.steps.receive.title"),
      description: t("howItWorks.steps.receive.description")
    },
    {
      icon: MessageSquare,
      title: t("howItWorks.steps.choose.title"),
      description: t("howItWorks.steps.choose.description")
    },
    {
      icon: CheckCircle,
      title: t("howItWorks.steps.hire.title"),
      description: t("howItWorks.steps.hire.description")
    }
  ];

  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("howItWorks.title")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-8 h-8 text-primary" />
              </div>
              <div className="text-sm text-primary font-medium mb-2">
                {t("howItWorksPage.step")} {index + 1}
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};