import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onOpenSignup: (type: "company" | "freelancer") => void;
}

export const CTASection = ({ onOpenSignup }: CTASectionProps) => {
  return (
    <section className="py-20 px-4 bg-primary/5">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para Começar?
          </h2>
          <p className="text-muted-foreground mb-8">
            Junte-se a milhares de empresas e freelancers que já estão crescendo com nossa plataforma.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => onOpenSignup("company")} className="gap-2">
              Criar Conta Grátis <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => onOpenSignup("freelancer")}>
              Sou Freelancer
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
