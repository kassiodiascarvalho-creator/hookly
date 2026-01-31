import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

export const Testimonials = () => {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: t("testimonials.items.0.author"),
      role: t("testimonials.items.0.role"),
      content: t("testimonials.items.0.quote"),
      rating: 5
    },
    {
      name: t("testimonials.items.1.author"),
      role: t("testimonials.items.1.role"),
      content: t("testimonials.items.1.quote"),
      rating: 5
    },
    {
      name: t("testimonials.items.2.author"),
      role: t("testimonials.items.2.role"),
      content: t("testimonials.items.2.quote"),
      rating: 5
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("testimonials.title")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("testimonials.subtitle")}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-card p-6 rounded-xl border border-border"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-muted-foreground mb-4">{testimonial.content}</p>
              <div>
                <div className="font-semibold">{testimonial.name}</div>
                <div className="text-sm text-muted-foreground">{testimonial.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};