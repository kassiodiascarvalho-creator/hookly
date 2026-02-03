import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Trophy, Award, CheckCircle, Star, Crown } from "lucide-react";
import { useState } from "react";
import { SignupModal } from "@/components/landing/SignupModal";

const awardsData = [
  {
    id: 1,
    title: "Nível 1 — Starter",
    value: "R$ 5 mil",
    description: "Primeiro marco: começou a construir tração e reputação.",
    image: "/awards/plaque-1.jpeg",
    icon: Trophy,
  },
  {
    id: 2,
    title: "Nível 2 — Bronze",
    value: "R$ 10 mil",
    description: "Consistência: entregas recorrentes e crescimento sólido.",
    image: "/awards/plaque-2.jpeg",
    icon: Award,
  },
  {
    id: 3,
    title: "Nível 3 — Silver",
    value: "R$ 25 mil",
    description: "Escala: resultados que mostram maturidade profissional.",
    image: "/awards/plaque-3.jpeg",
    icon: CheckCircle,
  },
  {
    id: 4,
    title: "Nível 4 — Gold",
    value: "R$ 50 mil",
    description: "Alta performance: qualidade + volume com estabilidade.",
    image: "/awards/plaque-4.jpeg",
    icon: Star,
  },
  {
    id: 5,
    title: "Nível 5 — Diamond",
    value: "R$ 100 mil",
    description: "Elite: referência dentro da comunidade HOOKLY.",
    image: "/awards/plaque-5.jpeg",
    icon: Crown,
  },
];

const rulesData = [
  "Apenas valores confirmados dentro da HOOKLY entram no marco.",
  "Transações com disputa, estorno ou fraude podem ser desconsideradas.",
  "Podemos solicitar confirmação de dados antes do envio.",
  "O prazo de entrega/produção pode variar conforme região e logística.",
  "O programa pode ser ajustado para manter justiça e transparência.",
];

const faqData = [
  {
    question: "Como ganho uma plaquinha?",
    answer: "Atingindo um marco de resultado confirmado na HOOKLY, conforme regras do programa.",
  },
  {
    question: "O que entra no cálculo?",
    answer: "Pagamentos confirmados de projetos concluídos pela plataforma.",
  },
  {
    question: "Cancelamentos contam?",
    answer: "Não, apenas resultados confirmados e elegíveis.",
  },
  {
    question: "Quando recebo?",
    answer: "Após validação e confirmação de envio, dentro do prazo informado no programa.",
  },
  {
    question: "Dá para acompanhar progresso?",
    answer: "Sim — você pode acompanhar seu progresso diretamente no dashboard da plataforma.",
  },
];

const Awards = () => {
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupType, setSignupType] = useState<"company" | "freelancer">("freelancer");

  const handleOpenSignup = (type: "company" | "freelancer") => {
    setSignupType(type);
    setSignupOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar onOpenSignup={handleOpenSignup} />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
              <Trophy className="h-5 w-5" />
              <span className="font-medium">Programa de Reconhecimento</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              Premiação HOOKLY
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-4">
              Reconhecemos quem faz acontecer.
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              As plaquinhas HOOKLY celebram marcos reais de resultado dentro da plataforma — 
              são a forma de valorizar quem escala com consistência e qualidade.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Recognition Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Seja reconhecido(a) pelo seu trabalho
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Na HOOKLY, resultado é consequência de consistência, qualidade e entrega. 
              Nosso programa de premiação existe para valorizar quem cresce com ética, 
              cumpre prazos e constrói reputação — projeto após projeto.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Awards Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Premiações</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A cada marco atingido, você desbloqueia um novo nível de reconhecimento. 
              As plaquinhas representam evolução e constância — não apenas volume.
            </p>
          </motion.div>

          <div className="grid gap-6 max-w-4xl mx-auto">
            {awardsData.map((award, index) => (
              <motion.div
                key={award.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      {/* Image */}
                      <div className="w-full md:w-1/3 bg-muted/50 flex items-center justify-center p-4">
                        <img
                          src={award.image}
                          alt={`Plaquinha ${award.title}`}
                          className="w-full max-w-[200px] h-auto object-contain rounded-lg"
                          loading="lazy"
                        />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-6 md:p-8 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                          <award.icon className="h-6 w-6 text-primary" />
                          <h3 className="text-xl md:text-2xl font-bold">{award.title}</h3>
                        </div>
                        <p className="text-2xl md:text-3xl font-bold text-primary mb-3">
                          {award.value}
                        </p>
                        <p className="text-muted-foreground">{award.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
              Regras Gerais
            </h2>
            <ul className="space-y-4">
              {rulesData.map((rule, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{rule}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tire suas dúvidas sobre o programa de premiação
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <Accordion type="single" collapsible className="w-full">
              {faqData.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Entre para a comunidade HOOKLY e comece a construir sua trajetória de sucesso.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => handleOpenSignup("freelancer")}
              >
                Começar na HOOKLY
              </Button>
              <Link to="/como-funciona">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Ver como funciona
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />

      <SignupModal 
        isOpen={signupOpen} 
        onClose={() => setSignupOpen(false)}
        type={signupType}
      />
    </div>
  );
};

export default Awards;
