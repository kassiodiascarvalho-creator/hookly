import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const FAQ = () => {
  const { t } = useTranslation();

  const faqs = [
    {
      question: t("faq.items.0.question"),
      answer: t("faq.items.0.answer")
    },
    {
      question: t("faq.items.1.question"),
      answer: t("faq.items.1.answer")
    },
    {
      question: t("faq.items.2.question"),
      answer: t("faq.items.2.answer")
    },
    {
      question: t("faq.items.3.question"),
      answer: t("faq.items.3.answer")
    },
    {
      question: t("faq.items.4.question"),
      answer: t("faq.items.4.answer")
    }
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("faq.title")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("faq.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};