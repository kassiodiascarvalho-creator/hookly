import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const features = [
  { feature: "Pagamentos via Escrow", us: true, others: false },
  { feature: "Sem taxas ocultas", us: true, others: false },
  { feature: "Suporte em Português", us: true, others: false },
  { feature: "Verificação de Freelancers", us: true, others: true },
  { feature: "Proteção ao Cliente", us: true, others: false },
  { feature: "Milestones e Entregas", us: true, others: true },
];

export const Comparison = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que nos Escolher?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Veja como nos comparamos com outras plataformas
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
              <div>Recurso</div>
              <div className="text-center text-primary">Nossa Plataforma</div>
              <div className="text-center text-muted-foreground">Outros</div>
            </div>
            {features.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-4 p-4 border-t border-border">
                <div className="text-sm">{item.feature}</div>
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
