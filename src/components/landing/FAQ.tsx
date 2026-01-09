import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Como funciona o sistema de pagamentos?",
    answer: "Utilizamos um sistema de escrow seguro. O cliente deposita o valor do projeto e ele fica protegido até a entrega ser aprovada. Assim, garantimos segurança para ambas as partes."
  },
  {
    question: "Quanto custa usar a plataforma?",
    answer: "A criação de conta é gratuita. Cobramos uma pequena taxa sobre os projetos concluídos, que é transparente e sem custos ocultos."
  },
  {
    question: "Como os freelancers são verificados?",
    answer: "Nosso processo de verificação inclui análise de portfólio, validação de identidade e avaliações de clientes anteriores."
  },
  {
    question: "Posso cancelar um projeto?",
    answer: "Sim, projetos podem ser cancelados seguindo nossa política de cancelamento. O valor em escrow é tratado de acordo com o andamento do projeto."
  },
  {
    question: "Qual o prazo para receber os pagamentos?",
    answer: "Freelancers recebem o pagamento em até 3 dias úteis após a aprovação da entrega pelo cliente."
  }
];

export const FAQ = () => {
  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre nossa plataforma
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
