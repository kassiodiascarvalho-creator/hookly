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

const AVATAR_URLS = [
  "https://randomuser.me/api/portraits/men/75.jpg",
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/men/46.jpg",
];

function useTestimonials(): Testimonial[] {
  const { t } = useTranslation();
  return [1, 2, 3].map((i, idx) => ({
    quote: t(`landing.testimonials.${i}.quote`),
    author: t(`landing.testimonials.${i}.author`),
    role: t(`landing.testimonials.${i}.role`),
    location: t(`landing.testimonials.${i}.location`),
    project: t(`landing.testimonials.${i}.project`),
    value: t(`landing.testimonials.${i}.value`),
    duration: t(`landing.testimonials.${i}.duration`),
    avatarUrl: AVATAR_URLS[idx],
  }));
}

export function TestimonialsCarousel() {
  const { t } = useTranslation();
  const testimonials = useTestimonials();
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => setCurrent((p) => (p + 1) % testimonials.length), [testimonials.length]);
  const prev = useCallback(() => setCurrent((p) => (p - 1 + testimonials.length) % testimonials.length), [testimonials.length]);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  const testimonial = testimonials[current];

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
            {t("landing.testimonials.title")}
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
                <span>{t("landing.testimonials.project")}: <strong className="text-foreground">{testimonial.project}</strong></span>
                <span>{t("landing.testimonials.value")}: <strong className="text-primary">{testimonial.value}</strong></span>
                <span>{t("landing.testimonials.deadline")}: <strong className="text-foreground">{testimonial.duration}</strong></span>
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
              {testimonials.map((_, i) => (
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
