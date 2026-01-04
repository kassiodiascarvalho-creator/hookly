import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, Code, Palette, TrendingUp, PenTool, Database, 
  Video, Briefcase, DollarSign, Scale, ChevronRight, 
  Shield, Globe, Zap, Check, X, Star, ChevronDown
} from "lucide-react";
import { useState } from "react";
import { languages, LanguageCode } from "@/lib/i18n";
import i18n from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Index = () => {
  const { t } = useTranslation();
  const [searchTab, setSearchTab] = useState<"talent" | "projects">("talent");
  const [currentLang, setCurrentLang] = useState<LanguageCode>(
    (i18n.language as LanguageCode) || "en"
  );

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

  const stats = [
    { value: "2,500+", label: t("hero.stats.talents") },
    { value: "98%", label: t("hero.stats.satisfaction") },
    { value: "$12M+", label: t("hero.stats.paid") },
    { value: "45+", label: t("hero.stats.categories") },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo />
            <div className="hidden md:flex items-center gap-6">
              <Link to="/como-funciona" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.howItWorks")}
              </Link>
              <Link to="/empresas" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.forCompanies")}
              </Link>
              <Link to="/freelancers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.forFreelancers")}
              </Link>
              <Link to="/precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("nav.pricing")}
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {languages.find(l => l.code === currentLang)?.flag}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {languages.map((lang) => (
                  <DropdownMenuItem key={lang.code} onClick={() => changeLanguage(lang.code)}>
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/login">
              <Button variant="ghost" size="sm">{t("nav.login")}</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">{t("nav.signup")}</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-hero text-secondary-foreground py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
                <Star className="h-4 w-4 fill-current" />
                {t("hero.badge")}
              </span>
              <h1 className="font-display text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-6">
                {t("hero.title")}<br />
                {t("hero.titleLine2")}<br />
                <span className="text-primary">{t("hero.titleLine3")}</span>
              </h1>
              <p className="text-lg text-secondary-foreground/80 mb-8 max-w-lg">
                {t("hero.subtitle")}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/signup">
                  <Button size="lg" className="gap-2">
                    {t("hero.cta")}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/talent-pool">
                  <Button size="lg" variant="outline" className="bg-transparent border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10">
                    {t("hero.ctaSecondary")}
                  </Button>
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-2 gap-4"
            >
              {stats.map((stat, i) => (
                <div key={i} className="bg-secondary-foreground/10 backdrop-blur-sm rounded-xl p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm text-secondary-foreground/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="py-8 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="bg-card rounded-2xl shadow-card p-2 max-w-3xl mx-auto">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setSearchTab("talent")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  searchTab === "talent" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {t("search.findTalent")}
              </button>
              <button
                onClick={() => setSearchTab("projects")}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  searchTab === "projects" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {t("search.findProjects")}
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t("search.placeholder")}
                  className="pl-10 h-12"
                />
              </div>
              <Button size="lg" className="h-12 px-8">{t("search.searchBtn")}</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">{t("categories.title")}</h2>
            <p className="text-muted-foreground">{t("categories.subtitle")}</p>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                to={`/categories/${cat.key}`}
                className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <cat.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-center">{t(`categories.${cat.key}`)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why HOOKLY */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">{t("whyHookly.title")}</h2>
            <p className="text-muted-foreground">{t("whyHookly.subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: t("whyHookly.features.verified.title"), desc: t("whyHookly.features.verified.description") },
              { icon: Globe, title: t("whyHookly.features.escrowTitle"), desc: t("whyHookly.features.escrowDesc") },
              { icon: Zap, title: t("whyHookly.features.matchingTitle"), desc: t("whyHookly.features.matchingDesc") },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-2xl p-6 shadow-card"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">{t("howItWorks.title")}</h2>
            <p className="text-muted-foreground">{t("howItWorks.subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {["post", "receive", "hire"].map((step, i) => (
              <div key={step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">
                  {t(`howItWorks.steps.${step}.title`)}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {t(`howItWorks.steps.${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">{t("pricing.title")}</h2>
            <p className="text-muted-foreground">{t("pricing.subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter */}
            <div className="bg-card rounded-2xl p-8 shadow-card">
              <h3 className="font-display text-xl font-semibold mb-2">{t("pricing.starter.name")}</h3>
              <div className="text-3xl font-bold mb-4">{t("pricing.starter.price")}</div>
              <p className="text-muted-foreground text-sm mb-6">{t("pricing.starter.description")}</p>
              <ul className="space-y-3 mb-8">
                {(t("pricing.starter.features", { returnObjects: true }) as string[]).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full">{t("pricing.starter.cta")}</Button>
            </div>
            {/* Business */}
            <div className="bg-secondary text-secondary-foreground rounded-2xl p-8 relative">
              <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded-full">
                {t("pricing.business.popular")}
              </span>
              <h3 className="font-display text-xl font-semibold mb-2">{t("pricing.business.name")}</h3>
              <div className="text-3xl font-bold mb-4">{t("pricing.business.price")}</div>
              <p className="text-secondary-foreground/80 text-sm mb-6">{t("pricing.business.description")}</p>
              <ul className="space-y-3 mb-8">
                {(t("pricing.business.features", { returnObjects: true }) as string[]).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button className="w-full">{t("pricing.business.cta")}</Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-3">{t("faq.title")}</h2>
            <p className="text-muted-foreground">{t("faq.subtitle")}</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {(t("faq.items", { returnObjects: true }) as Array<{ question: string; answer: string }>).map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-hero text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-bold mb-4">{t("cta.title")}</h2>
          <p className="text-secondary-foreground/80 mb-8 max-w-2xl mx-auto">{t("cta.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/signup">
              <Button size="lg">{t("cta.primary")}</Button>
            </Link>
            <Button size="lg" variant="outline" className="bg-transparent border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10">
              {t("cta.secondary")}
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <Logo className="text-secondary-foreground mb-4" />
              <p className="text-secondary-foreground/70 text-sm max-w-xs">{t("footer.description")}</p>
            </div>
            {["platform", "company", "resources"].map((section) => (
              <div key={section}>
                <h4 className="font-semibold mb-4">{t(`footer.${section}.title`)}</h4>
                <ul className="space-y-2 text-sm text-secondary-foreground/70">
                  {section === "platform" && (
                    <>
                      <li><Link to="/como-funciona" className="hover:text-secondary-foreground">{t("footer.platform.howItWorks")}</Link></li>
                      <li><Link to="/talent-pool" className="hover:text-secondary-foreground">{t("footer.platform.findTalent")}</Link></li>
                      <li><Link to="/precos" className="hover:text-secondary-foreground">{t("footer.platform.pricing")}</Link></li>
                    </>
                  )}
                  {section === "company" && (
                    <>
                      <li><a href="#" className="hover:text-secondary-foreground">{t("footer.company.about")}</a></li>
                      <li><a href="#" className="hover:text-secondary-foreground">{t("footer.company.careers")}</a></li>
                      <li><a href="#" className="hover:text-secondary-foreground">{t("footer.company.blog")}</a></li>
                    </>
                  )}
                  {section === "resources" && (
                    <>
                      <li><a href="#" className="hover:text-secondary-foreground">{t("footer.resources.help")}</a></li>
                      <li><a href="#" className="hover:text-secondary-foreground">{t("footer.resources.guides")}</a></li>
                    </>
                  )}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-secondary-foreground/10 pt-8 text-center text-sm text-secondary-foreground/50">
            {t("footer.copyright")}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
