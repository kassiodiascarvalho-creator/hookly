import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  location: string;
  project: string;
  value: string;
  duration: string;
  avatarUrl: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Testamos Upwork, 99freelas, Workana. No HOOKLY, encontramos nosso dev full-stack em 48h. O sistema de entregáveis nos deu controle total sobre o orçamento. Resultado? App lançado 3 semanas antes do prazo.",
    author: "Ricardo Mendes",
    role: "CPO @ NeoBank",
    location: "São Paulo, SP",
    project: "App Mobile",
    value: "R$28.000",
    duration: "6 semanas",
    avatarUrl: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    quote: "Como freelancer, o HOOKLY mudou minha vida. Em 3 meses, faturei mais do que em 8 meses nas outras plataformas. O escrow me dá segurança total — nunca mais trabalhei sem receber.",
    author: "Camila Torres",
    role: "UI/UX Designer",
    location: "Curitiba, PR",
    project: "SaaS Dashboard",
    value: "R$15.000",
    duration: "4 semanas",
    avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg",
  },
  {
    quote: "A verificação dos freelancers é real. Todos os profissionais que contratamos tinham portfólios sólidos e entregaram acima das expectativas. O melhor investimento que fizemos.",
    author: "Marcos Oliveira",
    role: "CTO @ DataFlow",
    location: "Belo Horizonte, MG",
    project: "Plataforma Analytics",
    value: "R$42.000",
    duration: "8 semanas",
    avatarUrl: "https://randomuser.me/api/portraits/men/46.jpg",
  },
];

export function TestimonialsCarousel() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((p) => (p + 1) % TESTIMONIALS.length), []);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length), []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const testimonial = TESTIMONIALS[current];

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold">
            {t("landing.testimonials.title", "Histórias reais de quem usa")}
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="surface-card p-8 md:p-10 border-glow"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground text-base md:text-lg leading-relaxed mb-8 italic">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4 mb-6">
                <img
                  src={testimonial.avatarUrl}
                  alt={testimonial.author}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="font-semibold text-foreground">{testimonial.author}</div>
                  <div className="text-xs text-primary">{testimonial.role}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.location}</div>
                </div>
              </div>

              {/* Project details */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground border-t border-border pt-5">
                <span>Projeto: <strong className="text-foreground">{testimonial.project}</strong></span>
                <span>Valor: <strong className="text-primary">{testimonial.value}</strong></span>
                <span>Prazo: <strong className="text-foreground">{testimonial.duration}</strong></span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:border-primary/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
