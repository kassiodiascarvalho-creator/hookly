import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, Rocket, Sparkles, Phone, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanConfig {
  type: string;
  name: string;
  priceDisplay: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink?: string;
  popular?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const PLANS: PlanConfig[] = [
  {
    type: "free",
    name: "Grátis",
    priceDisplay: "R$ 0",
    period: "",
    description: "Para experimentar a plataforma",
    features: [
      "Publicar projetos básicos",
      "Receber propostas de freelancers",
      "Pagamento protegido (escrow)",
      "Suporte por email",
    ],
    cta: "Começar Grátis",
    ctaLink: "/auth",
    icon: Building2,
  },
  {
    type: "starter",
    name: "Business Starter",
    priceDisplay: "R$ 149",
    period: "/mês",
    description: "Para equipes iniciantes",
    features: [
      "Até 5 projetos/mês",
      "Match acelerado com talentos",
      "Suporte por email prioritário",
      "Relatórios básicos",
      "Pagamento protegido",
    ],
    cta: "Assinar Starter",
    ctaLink: "/auth",
    icon: Zap,
  },
  {
    type: "pro",
    name: "Business Pro",
    priceDisplay: "R$ 299",
    period: "/mês",
    description: "Performance e visibilidade",
    features: [
      "Projetos ilimitados",
      "Destaque automático de projetos",
      "Suporte prioritário",
      "Relatórios avançados",
      "Match acelerado",
      "Pagamento protegido",
    ],
    cta: "Assinar Pro",
    ctaLink: "/auth",
    popular: true,
    icon: Rocket,
  },
  {
    type: "elite",
    name: "Business Elite",
    priceDisplay: "R$ 499",
    period: "/mês",
    description: "Poder total para RHs exigentes",
    features: [
      "Tudo do Pro +",
      "Conta dedicada",
      "Prioridade de talentos",
      "Acesso à API",
      "Dashboard de RH",
      "Suporte 24/7",
    ],
    cta: "Falar com Vendas",
    icon: Crown,
  },
];

export default function Pricing() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" size="sm">{t("nav.login")}</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">{t("nav.signup")}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6" variant="outline">
              <Sparkles className="h-3 w-3 mr-1" />
              Planos Empresariais
            </Badge>
            <h1 className="font-display text-4xl lg:text-5xl font-bold mb-6">
              Flexibilidade para contratar como sua empresa precisa
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4">
              Planos mensais sem compromisso, com cancelamento a qualquer momento.
              Escolha o que faz sentido para o seu momento.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {PLANS.map((plan, index) => {
              const PlanIcon = plan.icon;
              return (
                <motion.div
                  key={plan.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative rounded-2xl p-6 transition-all",
                    plan.popular 
                      ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 scale-105 border-2 border-primary" 
                      : "bg-card border shadow-card"
                  )}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <Badge 
                      className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Mais Popular
                    </Badge>
                  )}

                  <div className="text-center mb-6">
                    <div className={cn(
                      "inline-flex p-3 rounded-xl mb-3",
                      plan.popular ? "bg-primary-foreground/10" : "bg-primary/10"
                    )}>
                      <PlanIcon className={cn(
                        "h-6 w-6",
                        plan.popular ? "text-primary-foreground" : "text-primary"
                      )} />
                    </div>
                    <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                    <p className={cn(
                      "text-sm mt-1",
                      plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {plan.description}
                    </p>
                  </div>

                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{plan.priceDisplay}</span>
                    {plan.period && (
                      <span className={cn(
                        "text-sm",
                        plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        {plan.period}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          plan.popular ? "text-primary-foreground" : "text-primary"
                        )} />
                        <span className={plan.popular ? "text-primary-foreground/90" : ""}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {plan.type === "elite" ? (
                    <Button 
                      variant={plan.popular ? "secondary" : "outline"}
                      className="w-full gap-2"
                      asChild
                    >
                      <a href="mailto:comercial@hookly.com.br?subject=Interesse no Plano Elite">
                        <Phone className="h-4 w-4" />
                        {plan.cta}
                      </a>
                    </Button>
                  ) : (
                    <Link to={plan.ctaLink || "/auth"}>
                      <Button 
                        variant={plan.popular ? "secondary" : plan.type === "free" ? "outline" : "default"}
                        className="w-full gap-2"
                      >
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Cancele a qualquer momento
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Pagamento seguro via Stripe
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Suporte dedicado
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Escrow em todos os planos
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl font-bold mb-4">{t("pricingPage.faqTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("pricingPage.faqSubtitle")}</p>
          <div className="max-w-2xl mx-auto text-left space-y-4">
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">Como funciona a cobrança?</h3>
              <p className="text-muted-foreground text-sm">
                A cobrança é mensal e automática via cartão de crédito. Você pode cancelar a qualquer momento sem multas ou taxas adicionais.
              </p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">Posso trocar de plano?</h3>
              <p className="text-muted-foreground text-sm">
                Sim! Você pode fazer upgrade ou downgrade a qualquer momento. O valor é ajustado proporcionalmente.
              </p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">{t("pricingPage.faq.fees.question")}</h3>
              <p className="text-muted-foreground text-sm">{t("pricingPage.faq.fees.answer")}</p>
            </div>
            <div className="bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-2">{t("pricingPage.faq.payment.question")}</h3>
              <p className="text-muted-foreground text-sm">{t("pricingPage.faq.payment.answer")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Pronto para turbinar sua contratação?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Ative um plano empresarial e tenha acesso a benefícios exclusivos como destaque de projetos e suporte prioritário.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="gap-2">
                Começar Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="mailto:comercial@hookly.com.br?subject=Dúvidas sobre planos">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2">
                <Phone className="h-4 w-4" />
                Falar com Vendas
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
