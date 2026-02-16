import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function BeforeAfter() {
  const { t } = useTranslation();

  const items = [
    {
      before: { emoji: "😩", text: t("landing.beforeAfter.before1", "Filtrar 200 perfis genéricos") },
      after: { emoji: "🎯", text: t("landing.beforeAfter.after1", "3 talentos pré-verificados") },
    },
    {
      before: { emoji: "😩", text: t("landing.beforeAfter.before2", "Pagar por hora sem garantia") },
      after: { emoji: "💰", text: t("landing.beforeAfter.after2", "Pagar por entregável aprovado") },
    },
    {
      before: { emoji: "😩", text: t("landing.beforeAfter.before3", "Sem proteção de pagamento") },
      after: { emoji: "🔒", text: t("landing.beforeAfter.after3", "Escrow + garantia total") },
    },
    {
      before: { emoji: "😩", text: t("landing.beforeAfter.before4", "Taxas ocultas em tudo") },
      after: { emoji: "✨", text: t("landing.beforeAfter.after4", "Transparência total") },
    },
  ];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("landing.beforeAfter.title", "Por que equipes estão migrando para")}
            {" "}
            <span className="text-primary">HOOKLY</span>
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="surface-card p-6 opacity-60"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              {t("landing.beforeAfter.beforeLabel", "ANTES")}
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              {t("landing.beforeAfter.beforeSub", "(plataformas tradicionais)")}
            </p>
            <div className="space-y-5">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl">{item.before.emoji}</span>
                  <p className="text-sm text-muted-foreground">{item.before.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="surface-card p-6 border-primary/30 shadow-glow"
          >
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-6">
              {t("landing.beforeAfter.afterLabel", "COM HOOKLY")}
            </h3>
            <p className="text-xs text-primary/60 mb-6">&nbsp;</p>
            <div className="space-y-5">
              {items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-xl">{item.after.emoji}</span>
                  <p className="text-sm text-foreground font-medium">{item.after.text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
