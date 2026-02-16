import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { Check, Clock, DollarSign, Send } from "lucide-react";
import { useRef, useState, useEffect } from "react";

export function ProductShowcase() {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);

  const milestones = [
    { name: t("landing.showcase.milestone1", "Wireframes"), amount: "R$1.200", status: "approved" as const },
    { name: t("landing.showcase.milestone2", "UI Design"), amount: "R$2.800", status: "approved" as const },
    { name: t("landing.showcase.milestone3", "Protótipo Interativo"), amount: "R$1.500", status: "approved" as const },
  ];

  useEffect(() => {
    if (!isInView) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(timer);
  }, [isInView]);

  const totalApproved = Math.min(activeStep + 1, 3);

  return (
    <section className="py-24 relative" ref={ref}>
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("landing.showcase.title", "Veja como é pagar por")}{" "}
            <span className="italic bg-gradient-to-r from-primary via-purple-400 to-purple-500 bg-clip-text text-transparent">
              {t("landing.showcase.titleAccent", "RESULTADOS")}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("landing.showcase.subtitle", "(não por horas gastas no sofá)")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          {/* Mock window */}
          <div className="rounded-xl border border-border overflow-hidden bg-card/80 backdrop-blur-sm">
            {/* Window chrome bar */}
            <div className="px-5 py-3.5 flex items-center gap-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <span className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {t("landing.showcase.projectName", "Projeto: Redesign App Mobile")}
              </span>
            </div>

            {/* Milestones */}
            <div className="p-5 md:p-6 space-y-3">
              {milestones.map((ms, i) => {
                const isApproved = i < totalApproved;

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.4 + i * 0.15 }}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-500 ${
                      isApproved
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-card/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                        isApproved ? "bg-green-500" : "bg-muted-foreground/30"
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{ms.name}</p>
                        <p className={`text-xs transition-colors duration-500 flex items-center gap-1 ${
                          isApproved ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {isApproved ? (
                            <><Check className="h-3 w-3" /> {t("landing.showcase.approved", "Aprovado")}</>
                          ) : (
                            <><Clock className="h-3 w-3" /> {t("landing.showcase.inReview", "Em revisão")}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">$</span>
                      <span className={`text-sm font-semibold transition-colors duration-500 ${
                        isApproved ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {ms.amount} {t("landing.showcase.released", "liberado")}
                      </span>
                      {isApproved && i === totalApproved - 1 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-1"
                        >
                          <Send className="h-3.5 w-3.5 text-primary" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="px-5 md:px-6 pb-5 md:pb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{t("landing.showcase.progress", "Progresso")}</span>
                <span className="text-xs font-semibold text-primary">{totalApproved}/3 {t("landing.showcase.deliverables", "entregáveis")}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
                  animate={{ width: `${(totalApproved / 3) * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground mt-8 max-w-lg mx-auto"
        >
          {t("landing.showcase.bottomText", "Sem surpresas. Sem horas infladas.")}{" "}
          <span className="font-semibold text-foreground">
            {t("landing.showcase.bottomBold", "Aprovou? Pagamento liberado. Simples.")}
          </span>
        </motion.p>
      </div>
    </section>
  );
}
