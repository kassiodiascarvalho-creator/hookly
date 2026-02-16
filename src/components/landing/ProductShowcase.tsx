import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { Check, Clock, DollarSign } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface Milestone {
  name: string;
  amount: string;
  status: "approved" | "approved" | "reviewing";
}

export function ProductShowcase() {
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(0);

  const milestones: Milestone[] = [
    { name: t("landing.showcase.milestone1", "Wireframes"), amount: "R$1.200", status: "approved" },
    { name: t("landing.showcase.milestone2", "UI Design"), amount: "R$2.800", status: "approved" },
    { name: t("landing.showcase.milestone3", "Protótipo"), amount: "R$1.500", status: "reviewing" },
  ];

  useEffect(() => {
    if (!isInView) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(timer);
  }, [isInView]);

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
            {t("landing.showcase.title", "Veja como é pagar por")}
            {" "}
            <span className="text-gradient-primary underline-gradient italic">
              {t("landing.showcase.titleAccent", "RESULTADOS")}
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("landing.showcase.subtitle", "Sem surpresas. Sem horas infladas. Aprovou? Pagamento liberado.")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          {/* Mock platform card */}
          <div className="surface-card overflow-hidden border-glow">
            {/* Header bar */}
            <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {t("landing.showcase.projectName", "Projeto: Redesign App Mobile")}
                </h3>
                <p className="text-xs text-muted-foreground">3 {t("landing.showcase.deliverables", "entregáveis")} • R$5.500 {t("landing.showcase.total", "total")}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-green-500 font-medium">{t("landing.showcase.active", "Ativo")}</span>
              </div>
            </div>

            {/* Milestones */}
            <div className="p-6 space-y-4">
              {milestones.map((ms, i) => {
                const isApproved = ms.status === "approved" && i <= activeStep;
                const isReviewing = ms.status === "reviewing" || (ms.status === "approved" && i > activeStep);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.4 + i * 0.15 }}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-500 ${
                      isApproved && !isReviewing
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-500 ${
                        isApproved && !isReviewing ? "bg-green-500/20" : "bg-muted"
                      }`}>
                        {isApproved && !isReviewing ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {t("landing.showcase.deliverable", "Entregável")} {i + 1}: {ms.name}
                        </p>
                        <p className={`text-xs transition-colors duration-500 ${
                          isApproved && !isReviewing ? "text-green-500" : "text-muted-foreground"
                        }`}>
                          {isApproved && !isReviewing
                            ? `✅ ${t("landing.showcase.approved", "Aprovado")}`
                            : `🔄 ${t("landing.showcase.inReview", "Em revisão")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      <span className={`text-sm font-semibold transition-colors duration-500 ${
                        isApproved && !isReviewing ? "text-green-500" : "text-muted-foreground"
                      }`}>
                        {ms.amount} {isApproved && !isReviewing ? t("landing.showcase.released", "liberado") : t("landing.showcase.pending", "pendente")}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom action */}
            <div className="px-6 pb-6">
              <motion.div
                animate={activeStep >= 2 ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 0.3 }}
                className="w-full py-3 rounded-lg bg-primary/10 border border-primary/20 text-center"
              >
                <span className="text-sm text-primary font-semibold">
                  {activeStep >= 2 ? "🎉 " : ""}
                  {activeStep >= 2
                    ? t("landing.showcase.allApproved", "Todos os entregáveis aprovados!")
                    : t("landing.showcase.clickApprove", "Clique para aprovar entregáveis")}
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
