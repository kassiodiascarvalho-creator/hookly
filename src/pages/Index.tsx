import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Search,
  Code,
  Palette,
  TrendingUp,
  PenTool,
  Database,
  Video,
  Briefcase,
  DollarSign,
  Scale,
  ChevronRight,
  Shield,
  Globe,
  Zap,
  Check,
  X,
  Star,
  ChevronDown,
  FileText,
  Users,
  Sparkles,
  Menu,
  Building2,
  Award,
  Clock,
  Mail,
} from "lucide-react";
import { useState, useMemo } from "react";
import { languages, LanguageCode } from "@/lib/i18n";
import { useLandingStats, useLandingSocialLinks } from "@/hooks/useLandingContent";
import { ProviderLogosCarousel } from "@/components/landing/ProviderLogosCarousel";
import { CompanyLogosCarousel } from "@/components/landing/CompanyLogosCarousel";
import i18n from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Briefcase,
  Star,
  Globe,
  Shield,
  Zap,
  Award,
  Clock,
  DollarSign,
  Code,
  Palette,
  TrendingUp,
};

const Index = () => {
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<LanguageCode>((i18n.language as LanguageCode) || "en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // CMS Data - only for stats and social links (not text content which uses i18n)
  const { data: landingStats } = useLandingStats();
  const { data: socialLinks } = useLandingSocialLinks();

  const changeLanguage = (lang: LanguageCode) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  const categories = [
    { icon: Code, key: "development" },
    { icon: Palette, key: "design" },
    { icon: TrendingUp, key: "marketing" },
    { icon: PenTool, key: "writing" },
    { icon: Database, key: "dataScience" },
    { icon: Video, key: "videoPhoto" },
    { icon: Briefcase, key: "consulting" },
    { icon: DollarSign, key: "finance" },
    { icon: Scale, key: "legal" },
  ];

  // Use CMS stats if available, otherwise fallback to translations
  const stats = useMemo(() => {
    if (landingStats && landingStats.length > 0) {
      return landingStats.map(stat => ({
        value: stat.value,
        label: stat.label,
        icon: iconMap[stat.icon] || Users,
      }));
    }
    // Fallback to translations
    return [
      { value: "2,500+", label: t("hero.stats.talents"), icon: Users },
      { value: "8,400+", label: t("hero.stats.paid"), icon: Briefcase },
      { value: "98%", label: t("hero.stats.satisfaction"), icon: Star },
      { value: "45+", label: t("hero.stats.categories"), icon: Globe },
    ];
  }, [landingStats, t]);

  const comparisonFeatures = [
    { key: "kpiPayment", label: t("comparison.features.resultsBased") },
    { key: "escrow", label: t("comparison.features.escrowProtection") },
    { key: "certifications", label: t("comparison.features.verifiedTalent") },
    { key: "matching", label: t("comparison.features.noHiddenFees") },
    { key: "multiCurrency", label: t("comparison.features.multiCurrency") },
    { key: "integration", label: t("comparison.features.integration") },
  ];

  const comparisonData = {
    hookly: [true, true, true, true, true, true],
    upwork: [false, true, false, false, false, false],
    fiverr: [false, false, false, false, true, false],
    others: [false, false, true, false, false, false],
  };

  const navLinks = [
    { to: "/como-funciona", label: t("nav.howItWorks") },
    { to: "/empresas", label: t("nav.forCompanies") },
    { to: "/freelancers", label: t("nav.forFreelancers") },
    { to: "#faq", label: "FAQ", isAnchor: true },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-glow opacity-60" />
        <div className="absolute inset-0 bg-purple-glow opacity-40" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass-dark border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo size="md" />
            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) =>
                link.isAnchor ? (
                  <a
                    key={link.label}
                    href={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  {languages.find((l) => l.code === currentLang)?.flag}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className="hover:bg-accent"
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="btn-gradient">
                  {t("nav.signup")}
                </Button>
              </Link>
            </div>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border w-[300px]">
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) =>
                    link.isAnchor ? (
                      <a
                        key={link.label}
                        href={link.to}
                        className="text-lg text-foreground"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.to}
                        to={link.to}
                        className="text-lg text-foreground"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                  <div className="border-t border-border pt-6 flex flex-col gap-3">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        {t("nav.login")}
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full btn-gradient">{t("nav.signup")}</Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="container mx-auto px-4">
          {/* Toggle Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center gap-3 mb-12"
          >
            <Link to="/empresas">
              <Button className="btn-gradient rounded-full px-6">{t("nav.forCompanies")}</Button>
            </Link>
            <Link to="/freelancers">
              <Button variant="outline" className="rounded-full px-6 border-border hover:bg-accent">
                {t("nav.forFreelancers")}
              </Button>
            </Link>
          </motion.div>

          {/* Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6">
              <span className="text-gradient-primary">{t("hero.title")}</span>
              <br />
              <span className="text-gradient-primary">{t("hero.titleLine2")}</span>
            </h1>
            <p className="text-xl md:text-2xl text-primary font-semibold mb-4">{t("hero.titleLine3")}</p>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">{t("hero.subtitle")}</p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mb-16">
              <Link to="/auth">
                <Button size="lg" className="btn-gradient text-lg px-8 py-6 rounded-xl gap-2">
                  {t("hero.cta")}
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/talent-pool">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 rounded-xl border-border hover:bg-accent"
                >
                  {t("hero.ctaSecondary")}
                </Button>
              </Link>
              <Link to="/premiacao">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 rounded-xl border-primary/50 hover:bg-primary/10 gap-2"
                >
                  <Award className="h-5 w-5" />
                  Premiação
                </Button>
              </Link>
            </div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
            >
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="surface-card p-6 text-center group hover:border-primary/30 transition-all duration-300"
                >
                  <stat.icon className="h-6 w-6 text-primary mx-auto mb-3 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Company Logos Carousel */}
      <CompanyLogosCarousel />

      {/* Categories Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t("categories.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("categories.subtitle")}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4 max-w-5xl mx-auto"
          >
            {categories.map((cat, i) => (
              <Link
                key={cat.key}
                to={`/talent-pool?category=${cat.key}`}
                className="surface-card-hover p-4 text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <cat.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  {t(`categories.${cat.key}`)}
                </span>
              </Link>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8"
          >
            <Link to="/talent-pool">
              <Button variant="outline" className="border-border hover:bg-accent gap-2">
                {t("categories.viewAll")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t("howItWorks.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("howItWorks.subtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {["post", "receive", "hire"].map((step, i) => {
              return (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="surface-card-hover p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    {i === 0 && <FileText className="h-7 w-7 text-primary" />}
                    {i === 1 && <Users className="h-7 w-7 text-primary" />}
                    {i === 2 && <Sparkles className="h-7 w-7 text-primary" />}
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-3">{t(`howItWorks.steps.${step}.title`)}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(`howItWorks.steps.${step}.description`)}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Provider Logos & Trust Badges */}
      <ProviderLogosCarousel />

      {/* Why HOOKLY - Comparison Table */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t("comparison.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("comparison.subtitle")}</p>
          </motion.div>

          {/* Comparison Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto overflow-x-auto"
          >
            <div className="surface-card overflow-hidden min-w-[600px]">
              {/* Header */}
              <div className="grid grid-cols-5 border-b border-border">
                <div className="p-4 text-sm font-medium text-muted-foreground">{t("comparison.feature")}</div>
                <div className="p-4 text-center">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-semibold">
                    {t("comparison.hookly")}
                  </span>
                </div>
                <div className="p-4 text-center text-sm font-medium text-muted-foreground">{t("comparison.upwork")}</div>
                <div className="p-4 text-center text-sm font-medium text-muted-foreground">{t("comparison.fiverr")}</div>
                <div className="p-4 text-center text-sm font-medium text-muted-foreground">{t("comparison.others")}</div>
              </div>

              {/* Rows */}
              {comparisonFeatures.map((feature, i) => (
                <div
                  key={feature.key}
                  className={`grid grid-cols-5 ${i < comparisonFeatures.length - 1 ? "border-b border-border/50" : ""}`}
                >
                  <div className="p-4 text-sm text-muted-foreground">{feature.label}</div>
                  <div className="p-4 flex justify-center">
                    {comparisonData.hookly[i] ? (
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-4 flex justify-center">
                    {comparisonData.upwork[i] ? (
                      <Check className="h-5 w-5 text-muted-foreground/50" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-4 flex justify-center">
                    {comparisonData.fiverr[i] ? (
                      <Check className="h-5 w-5 text-muted-foreground/50" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="p-4 flex justify-center">
                    {comparisonData.others[i] ? (
                      <Check className="h-5 w-5 text-muted-foreground/50" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t("pricing.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("pricing.subtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="surface-card p-8"
            >
              <h3 className="font-display text-2xl font-bold mb-2">{t("pricing.starter.name")}</h3>
              <p className="text-muted-foreground text-sm mb-6">{t("pricing.starter.description")}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">{t("pricing.starter.price")}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(t("pricing.starter.features", { returnObjects: true }) as string[]).map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button variant="outline" className="w-full border-border hover:bg-accent">
                  {t("pricing.starter.cta")}
                </Button>
              </Link>
            </motion.div>

            {/* Business Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="surface-card p-8 relative border-primary/50"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                  {t("pricing.business.popular")}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold mb-2">{t("pricing.business.name")}</h3>
              <p className="text-muted-foreground text-sm mb-6">{t("pricing.business.description")}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-primary">{t("pricing.business.price")}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(t("pricing.business.features", { returnObjects: true }) as string[]).map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button className="w-full btn-gradient">{t("pricing.business.cta")}</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t("testimonials.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("testimonials.subtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {(
              t("testimonials.items", { returnObjects: true }) as Array<{ quote: string; author: string; role: string }>
            )
              .slice(0, 3)
              .map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="surface-card-hover p-6"
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed italic">"{testimonial.quote}"</p>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">
                        {testimonial.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{testimonial.author}</div>
                      <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 relative">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              {t("faq.title")}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t("faq.subtitle")}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {(t("faq.items", { returnObjects: true }) as Array<{ question: string; answer: string }>).map(
                (item, i) => (
                  <AccordionItem
                    key={i}
                    value={`item-${i}`}
                    className="surface-card px-6 border border-border rounded-xl overflow-hidden"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-5 text-foreground">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-5">{item.answer}</AccordionContent>
                  </AccordionItem>
                ),
              )}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-gradient-primary">
              {t("cta.title")}
            </h2>
            <p className="text-muted-foreground text-lg mb-10">{t("cta.subtitle")}</p>
            <Link to="/auth">
              <Button size="lg" className="btn-gradient text-lg px-10 py-6 rounded-xl">
                {t("cta.primary")}
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <Logo className="mb-4" />
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">{t("footer.description")}</p>
              <a 
                href="mailto:support@hooklyapp.com" 
                className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>support@hooklyapp.com</span>
              </a>
              <div className="flex gap-3 mt-6 flex-wrap">
                {socialLinks && socialLinks.length > 0 ? (
                  socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                      title={link.platform}
                    >
                      {link.icon === 'twitter' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                        </svg>
                      )}
                      {link.icon === 'linkedin' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                        </svg>
                      )}
                      {link.icon === 'github' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                      )}
                      {link.icon === 'instagram' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                      )}
                      {link.icon === 'facebook' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      )}
                      {link.icon === 'whatsapp' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      )}
                      {link.icon === 'youtube' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      )}
                      {link.icon === 'tiktok' && (
                        <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                        </svg>
                      )}
                    </a>
                  ))
                ) : (
                  // Fallback to default social links
                  <>
                    <a
                      href="#"
                      className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                    >
                      <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                      </svg>
                    </a>
                    <a
                      href="#"
                      className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                    >
                      <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                    </a>
                    <a
                      href="#"
                      className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center hover:border-primary/50 transition-colors"
                    >
                      <svg className="h-4 w-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Footer Links */}
            <div>
              <h4 className="font-semibold mb-4 text-foreground">{t("footer.platform.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <Link to="/como-funciona" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.platform.howItWorks")}
                  </Link>
                </li>
                <li>
                  <Link to="/talent-pool" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.platform.findTalent")}
                  </Link>
                </li>
                <li>
                  <Link to="/precos" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.platform.pricing")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">{t("footer.company.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.company.about")}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.company.careers")}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.company.blog")}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-foreground">{t("footer.legal.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.legal.privacy")}
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t("footer.legal.terms")}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">{t("footer.copyright")}</p>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                    {languages.find((l) => l.code === currentLang)?.flag}
                    <span className="text-xs">{currentLang.toUpperCase()}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className="hover:bg-accent"
                    >
                      <span className="mr-2">{lang.flag}</span>
                      {lang.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
