import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Globe,
  Zap,
  Check,
  Star,
  ChevronDown,
  FileText,
  Users,
  Sparkles,
  Menu,
  Mail,
  Rocket,
  ArrowRight,
  Play,
} from "lucide-react";
import { useState } from "react";
import { languages, LanguageCode } from "@/lib/i18n";
import { useLandingStats, useLandingSocialLinks } from "@/hooks/useLandingContent";
import { CompanyLogosCarousel } from "@/components/landing/CompanyLogosCarousel";
import { ProviderLogosCarousel } from "@/components/landing/ProviderLogosCarousel";
import { ActivityTicker } from "@/components/landing/ActivityTicker";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { BeforeAfter } from "@/components/landing/BeforeAfter";
import { SocialProofNotification } from "@/components/landing/SocialProofNotification";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { TalentGallery } from "@/components/landing/TalentGallery";
import { TestimonialsCarousel } from "@/components/landing/TestimonialsCarousel";
import i18n from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentLang, setCurrentLang] = useState<LanguageCode>((i18n.language as LanguageCode) || "en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ctaEmail, setCtaEmail] = useState("");

  const { data: socialLinks } = useLandingSocialLinks();

  const changeLanguage = (lang: LanguageCode) => {
    i18n.changeLanguage(lang);
    setCurrentLang(lang);
  };

  const navLinks = [
    { to: "/como-funciona", label: t("nav.howItWorks") },
    { to: "/empresas", label: t("nav.forCompanies") },
    { to: "/freelancers", label: t("nav.forFreelancers") },
    { to: "/premiacao", label: t("nav.awards", "Premiação") },
    { to: "#faq", label: "FAQ", isAnchor: true },
  ];

  const handleCtaEmail = () => {
    if (ctaEmail) {
      navigate(`/auth?email=${encodeURIComponent(ctaEmail)}`);
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Social Proof Notification */}
      <SocialProofNotification />

      {/* Sticky Mobile CTA */}
      <StickyMobileCTA />

      {/* ─── NAVBAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-dark">
        <div className="container mx-auto px-4 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo size="md" />
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) =>
                link.isAnchor ? (
                  <a key={link.label} href={link.to} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-[hsl(340_92%_74%)] transition-all duration-300 group-hover:w-full rounded-full" />
                  </a>
                ) : (
                  <Link key={link.to} to={link.to} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group">
                    {link.label}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-[hsl(340_92%_74%)] transition-all duration-300 group-hover:w-full rounded-full" />
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
                  <DropdownMenuItem key={lang.code} onClick={() => changeLanguage(lang.code)} className="hover:bg-accent">
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/5">
                  {t("nav.login")}
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="btn-gradient rounded-xl px-6">{t("nav.signup")}</Button>
              </Link>
            </div>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card border-border w-[300px]">
                <div className="flex flex-col gap-6 mt-8">
                  {navLinks.map((link) =>
                    link.isAnchor ? (
                      <a key={link.label} href={link.to} className="text-lg text-foreground" onClick={() => setMobileMenuOpen(false)}>
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.to} to={link.to} className="text-lg text-foreground" onClick={() => setMobileMenuOpen(false)}>
                        {link.label}
                      </Link>
                    ),
                  )}
                  <div className="border-t border-border pt-6 flex flex-col gap-3">
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full">{t("nav.login")}</Button>
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

      {/* ─── SECTION 1: HERO ─── */}
      <section className="relative min-h-screen flex items-center pt-[72px] overflow-hidden">
        {/* Animated orb backgrounds */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[200px] -right-[100px] w-[600px] h-[600px] rounded-full opacity-30 animate-orb-float" style={{ background: 'hsl(249 76% 62%)', filter: 'blur(120px)' }} />
          <div className="absolute -bottom-[200px] -left-[100px] w-[500px] h-[500px] rounded-full opacity-30 animate-orb-float" style={{ background: 'hsl(175 100% 40%)', filter: 'blur(120px)', animationDelay: '-7s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-10 animate-orb-float" style={{ background: 'hsl(340 92% 74%)', filter: 'blur(120px)', animationDelay: '-14s' }} />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 hero-grid-pattern pointer-events-none" />

        <div className="container mx-auto px-4 lg:px-16 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-[1400px] mx-auto">
            {/* Left side — Copy */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-[620px]"
            >
              {/* Live badge */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8"
                style={{ background: 'hsl(175 100% 40% / 0.08)', borderColor: 'hsl(175 100% 40% / 0.2)' }}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-[-3px] rounded-full border animate-live-pulse" style={{ borderColor: 'hsl(175 100% 40%)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'hsl(175 100% 40%)' }} />
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'hsl(175 100% 40%)' }}>
                  <strong className="text-foreground">2.847</strong> {t("landing.hero.liveBadge", "projetos completados este mês")}
                </span>
              </motion.div>

              <h1 className="font-display text-[40px] md:text-[52px] lg:text-[72px] font-extrabold leading-[1.05] mb-6 tracking-[-2px]">
                <span className="text-foreground">{t("landing.hero.line1", "Contrate por")}</span>
                <br />
                <span className="text-gradient-primary">{t("landing.hero.line2", "Resultados.")}</span>
                <br />
                <span className="line-through opacity-30 text-muted-foreground text-[30px] md:text-[38px] lg:text-[48px]">
                  {t("landing.hero.line3", "Não por promessas.")}
                </span>
              </h1>

              <p className="text-[16px] md:text-[19px] text-muted-foreground mb-10 max-w-[480px] leading-[1.7]">
                {t("landing.hero.desc1", "A única plataforma onde você ")}<strong className="text-foreground">{t("landing.hero.descHighlight", "paga apenas pelo que foi entregue")}</strong>{t("landing.hero.desc2", ". Freelancers verificados, escrow seguro, zero surpresas.")}
              </p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-12"
              >
                <Link to="/auth">
                  <Button size="lg" className="btn-gradient text-base px-8 py-6 rounded-[14px] gap-2.5 relative overflow-hidden group">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    ✦ {t("landing.hero.cta", "Encontrar Talentos Agora")}
                  </Button>
                </Link>
                <Link to="/como-funciona">
                  <Button size="lg" variant="ghost" className="text-muted-foreground gap-2 text-[15px] border border-white/8 rounded-[14px] hover:bg-white/5 hover:text-foreground hover:border-white/15 px-6 py-6">
                    ▶ {t("landing.hero.ctaSecondary", "Ver como funciona")}
                  </Button>
                </Link>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="flex flex-wrap items-center gap-6 text-[13px] text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'hsl(175 100% 40% / 0.15)', color: 'hsl(175 100% 40%)' }}>✓</span>
                  {t("landing.hero.trust1", "100% Verificados")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'hsl(249 76% 62% / 0.15)', color: 'hsl(249 76% 62%)' }}>🛡</span>
                  {t("landing.hero.trust2", "Escrow Seguro")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'hsl(48 95% 82% / 0.15)', color: 'hsl(48 95% 82%)' }}>⚡</span>
                  {t("landing.hero.trust3", "Match em 24h")}
                </span>
              </motion.div>
            </motion.div>

            {/* Right side — Interactive widget with floating cards */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="relative hidden lg:block"
            >
              {/* Floating cards */}
              <div className="absolute -top-5 -right-8 z-10 p-3 px-4 rounded-[14px] bg-card/90 border backdrop-blur-sm animate-float-card" style={{ borderColor: 'hsl(249 76% 62% / 0.15)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white">M</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">Maria S.</span>
                    <span className="text-[11px]" style={{ color: 'hsl(175 100% 40%)' }}>Acabou de receber</span>
                  </div>
                  <span className="text-sm font-bold ml-2" style={{ color: 'hsl(175 100% 40%)' }}>R$4.500</span>
                </div>
              </div>

              <div className="absolute bottom-10 -left-10 z-10 p-3 px-4 rounded-[14px] bg-card/90 border backdrop-blur-sm animate-float-card" style={{ borderColor: 'hsl(249 76% 62% / 0.15)', animationDelay: '-2s' }}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: 'hsl(48 95% 82%)' }}>★★★★★</span>
                  <span className="text-[11px] text-muted-foreground">98% aprovação</span>
                </div>
              </div>

              <div className="absolute -bottom-4 right-10 z-10 p-3 px-4 rounded-[14px] bg-card/90 border backdrop-blur-sm animate-float-card" style={{ borderColor: 'hsl(249 76% 62% / 0.15)', animationDelay: '-4s' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, hsl(175 100% 40%), hsl(160 80% 38%))' }}>T</div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-foreground">Tech Corp</span>
                    <span className="text-[11px]" style={{ color: 'hsl(175 100% 40%)' }}>3 devs contratados</span>
                  </div>
                </div>
              </div>

              {/* Widget */}
              <div className="relative rounded-3xl border p-8 backdrop-blur-xl overflow-hidden" style={{ background: 'hsl(228 35% 7% / 0.8)', borderColor: 'hsl(249 76% 62% / 0.15)' }}>
                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-secondary" />

                <div className="flex items-center gap-2.5 mb-7">
                  <span className="w-2.5 h-2.5 rounded-full animate-live-pulse" style={{ background: 'hsl(175 100% 40%)' }} />
                  <span className="text-[15px] font-semibold text-foreground">
                    {t("landing.hero.formTitle", "Busca rápida de talentos")}
                  </span>
                </div>

                <div className="space-y-4 mb-4">
                  <div>
                    <label className="text-[12px] font-medium text-muted-foreground mb-2 block uppercase tracking-[0.5px]">{t("landing.hero.formSkill", "Preciso de um...")}</label>
                    <select className="w-full h-12 rounded-xl border px-4 text-[15px] text-foreground appearance-none cursor-pointer transition-all focus:outline-none" style={{ borderColor: 'hsl(249 76% 62% / 0.15)', background: 'hsl(228 50% 3% / 0.6)' }}>
                      <option>{t("landing.hero.selectSpecialty", "Selecione a especialidade")}</option>
                      <option>Desenvolvedor Full-Stack</option>
                      <option>UI/UX Designer</option>
                      <option>Growth Marketing</option>
                      <option>Data Science / ML</option>
                      <option>Mobile Developer</option>
                      <option>DevOps Engineer</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-muted-foreground mb-2 block uppercase tracking-[0.5px]">Budget</label>
                      <input type="text" placeholder="R$ Budget" className="w-full h-12 rounded-xl border px-4 text-[15px] text-foreground transition-all focus:outline-none" style={{ borderColor: 'hsl(249 76% 62% / 0.15)', background: 'hsl(228 50% 3% / 0.6)' }} />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-muted-foreground mb-2 block uppercase tracking-[0.5px]">{t("landing.hero.formDeadline", "Prazo")}</label>
                      <select className="w-full h-12 rounded-xl border px-4 text-[15px] text-foreground appearance-none cursor-pointer transition-all focus:outline-none" style={{ borderColor: 'hsl(249 76% 62% / 0.15)', background: 'hsl(228 50% 3% / 0.6)' }}>
                        <option>{t("landing.hero.formDeadline", "Prazo")}</option>
                        <option>1 semana</option>
                        <option>2 semanas</option>
                        <option>1 mês</option>
                        <option>2+ meses</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Link to="/auth" className="block">
                  <Button className="w-full py-4 text-base font-semibold rounded-[14px] btn-gradient gap-2 h-auto">
                    ✦ {t("landing.hero.formCta", "Encontrar Talentos Agora")}
                  </Button>
                </Link>

                <div className="flex items-center gap-4 mt-4 text-[12px] text-muted-foreground justify-center">
                  <span className="flex items-center gap-1">✓ {t("landing.hero.free", "Grátis para começar")}</span>
                  <span className="flex items-center gap-1">✓ {t("landing.hero.noCommit", "Sem compromisso")}</span>
                </div>
              </div>
            </motion.div>

            {/* Mobile widget (simplified) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="lg:hidden"
            >
              <div className="surface-card p-6 border-glow">
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'hsl(175 100% 40%)' }} />
                  <h3 className="font-display font-semibold text-foreground text-sm">
                    {t("landing.hero.formTitle", "Busca rápida de talentos")}
                  </h3>
                </div>
                <div className="space-y-3 mb-4">
                  <select className="w-full h-11 rounded-lg border border-border bg-background/80 px-4 text-sm text-foreground appearance-none cursor-pointer">
                    <option>{t("landing.hero.selectSpecialty", "Selecione a especialidade")}</option>
                    <option>Designer UX/UI</option>
                    <option>Desenvolvedor Full Stack</option>
                    <option>Growth Marketing</option>
                  </select>
                </div>
                <Link to="/auth">
                  <Button className="w-full btn-gradient gap-2 py-5 rounded-xl">
                    ✦ {t("landing.hero.formCta", "Encontrar Talentos Agora")}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: ACTIVITY TICKER ─── */}
      <ActivityTicker />

      {/* ─── SECTION 3: COMPANY LOGOS ─── */}
      <CompanyLogosCarousel />

      {/* ─── SECTION 4: PRODUCT SHOWCASE ─── */}
      <ProductShowcase />

      {/* ─── SECTION 5: TALENT GALLERY ─── */}
      <TalentGallery />

      {/* ─── SECTION 6: HOW IT WORKS — 3 Steps ─── */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold mb-5" style={{ background: 'hsl(249 76% 62% / 0.08)', border: '1px solid hsl(249 76% 62% / 0.15)', color: 'hsl(249 76% 62%)' }}>
              🎯 {t("landing.steps.tag", "Simples assim")}
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-[-1.5px] mb-4">
              {t("landing.howItWorks.title", "3 passos. 0 complicação.")}
            </h2>
          </motion.div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-20 left-[16.6%] right-[16.6%] h-0.5 opacity-20" style={{ background: 'linear-gradient(90deg, hsl(249 76% 62%), hsl(175 100% 40%), hsl(340 92% 74%))' }} />

            {[
              { step: "post", number: "01", time: t("landing.howItWorks.time1", "⏱ 3 minutos"), color: 'hsl(249 76% 62%)' },
              { step: "receive", number: "02", time: t("landing.howItWorks.time2", "⏱ 24 horas"), color: 'hsl(175 100% 40%)' },
              { step: "hire", number: "03", time: t("landing.howItWorks.time3", "✅ Entregáveis aprovados"), color: 'hsl(340 92% 74%)' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="surface-card p-8 md:p-10 text-center hover:translate-y-[-4px] transition-all duration-300 relative z-10"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-xl font-extrabold mx-auto mb-5"
                  style={{ background: `${item.color} / 0.1)`.replace(')', ''), border: `1px solid ${item.color} / 0.2)`.replace(')', ''), color: item.color }}
                >
                  {item.number}
                </div>
                <h3 className="font-display text-xl md:text-[22px] font-bold mb-3">{t(`howItWorks.steps.${item.step}.title`)}</h3>
                <p className="text-[15px] text-muted-foreground leading-relaxed mb-4">{t(`howItWorks.steps.${item.step}.description`)}</p>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold"
                  style={{ background: `${item.color} / 0.08)`.replace(')', ''), color: item.color }}
                >
                  {item.time}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 7: BEFORE vs AFTER ─── */}
      <BeforeAfter />

      {/* ─── SECTION 8: PROVIDER LOGOS & TRUST ─── */}
      <ProviderLogosCarousel />

      {/* ─── SECTION 9: TESTIMONIALS ─── */}
      <TestimonialsCarousel />

      {/* ─── SECTION 10: PRICING ─── */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold mb-5" style={{ background: 'hsl(249 76% 62% / 0.08)', border: '1px solid hsl(249 76% 62% / 0.15)', color: 'hsl(249 76% 62%)' }}>
              💎 {t("landing.pricing.tag", "Transparente")}
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-[-1.5px] mb-4">{t("pricing.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("pricing.subtitle")}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[800px] mx-auto">
            {/* Starter */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="surface-card p-10 hover:translate-y-[-4px] transition-all duration-300">
              <h3 className="font-display text-[22px] font-bold mb-1">{t("pricing.starter.name")}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t("pricing.starter.description")}</p>
              <div className="mb-8">
                <span className="text-[42px] font-display font-extrabold text-gradient-primary">{t("pricing.starter.price")}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(t("pricing.starter.features", { returnObjects: true }) as string[]).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0" style={{ background: 'hsl(175 100% 40% / 0.1)', color: 'hsl(175 100% 40%)' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button variant="outline" className="w-full rounded-[14px] py-3.5 text-[15px] font-semibold border-white/10 hover:bg-white/5">{t("pricing.starter.cta")}</Button>
              </Link>
            </motion.div>

            {/* Business */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="surface-card p-10 relative hover:translate-y-[-4px] transition-all duration-300" style={{ borderColor: 'hsl(249 76% 62% / 0.4)', background: 'hsl(249 76% 62% / 0.05)' }}>
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-purple-500" />
              <div className="absolute -top-3 right-6">
                <span className="px-4 py-1 rounded-full text-xs font-semibold btn-gradient">{t("pricing.business.popular")}</span>
              </div>
              <h3 className="font-display text-[22px] font-bold mb-1">{t("pricing.business.name")}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t("pricing.business.description")}</p>
              <div className="mb-8">
                <span className="text-[32px] font-display font-extrabold" style={{ background: 'linear-gradient(135deg, hsl(340 92% 74%), hsl(48 95% 82%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t("pricing.business.price")}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(t("pricing.business.features", { returnObjects: true }) as string[]).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] flex-shrink-0" style={{ background: 'hsl(175 100% 40% / 0.1)', color: 'hsl(175 100% 40%)' }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link to="/auth">
                <Button className="w-full btn-gradient rounded-[14px] py-3.5 text-[15px] font-semibold">{t("pricing.business.cta")}</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 11: FAQ ─── */}
      <section id="faq" className="py-24 relative">
        <div className="container mx-auto px-4 max-w-[700px]">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold mb-5" style={{ background: 'hsl(249 76% 62% / 0.08)', border: '1px solid hsl(249 76% 62% / 0.15)', color: 'hsl(249 76% 62%)' }}>
              ❓ {t("landing.faq.tag", "Dúvidas")}
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-[-1.5px] mb-4">{t("faq.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("faq.subtitle")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Accordion type="single" collapsible className="w-full space-y-0">
              {(t("faq.items", { returnObjects: true }) as Array<{ question: string; answer: string }>).map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-b border-white/4 px-0">
                  <AccordionTrigger className="text-left hover:no-underline py-6 text-foreground font-semibold text-base hover:text-primary transition-colors">{item.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-6 text-[15px] leading-[1.7]">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* ─── SECTION 12: CTA FINAL ─── */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-[700px] mx-auto">
            <div className="relative rounded-[32px] p-10 md:p-16 text-center overflow-hidden" style={{ background: 'hsl(249 76% 62% / 0.04)', border: '1px solid hsl(249 76% 62% / 0.15)' }}>
              {/* Top gradient line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-secondary to-[hsl(340_92%_74%)]" />

              <h2 className="font-display text-3xl md:text-[40px] font-extrabold tracking-[-1px] mb-4">
                {t("landing.ctaFinal.title1", "Seu próximo projeto merece")}<br />
                {t("landing.ctaFinal.title2", "talentos ")}
                <span className="text-gradient-primary">{t("landing.ctaFinal.titleHighlight", "VERIFICADOS.")}</span>
              </h2>
              <p className="text-[17px] text-muted-foreground mb-9 leading-relaxed">
                {t("landing.ctaFinal.subtitle", "Junte-se a milhares de profissionais e empresas que já faturam com resultados reais.")}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-[480px] mx-auto mb-6">
                <Input
                  type="email"
                  placeholder={t("landing.ctaFinal.emailPlaceholder", "Seu email de trabalho")}
                  value={ctaEmail}
                  onChange={(e) => setCtaEmail(e.target.value)}
                  className="flex-1 rounded-[14px] py-4 px-5 text-[15px] h-auto"
                  style={{ borderColor: 'hsl(249 76% 62% / 0.15)', background: 'hsl(228 50% 3% / 0.6)' }}
                  onKeyDown={(e) => e.key === "Enter" && handleCtaEmail()}
                />
                <Button className="btn-gradient gap-2 whitespace-nowrap rounded-[14px] py-4 px-7 h-auto text-[15px] font-semibold" onClick={handleCtaEmail}>
                  ✦ {t("landing.ctaFinal.cta", "Criar Conta Grátis")}
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-5 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5">✓ {t("landing.ctaFinal.noCreditCard", "Sem cartão de crédito")}</span>
                <span className="flex items-center gap-1.5">✓ {t("landing.ctaFinal.quickSetup", "Setup em 2 minutos")}</span>
                <span className="flex items-center gap-1.5">✓ {t("landing.ctaFinal.cancelAnytime", "Cancele quando quiser")}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/4 py-16 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <Logo className="mb-4" />
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">{t("footer.description")}</p>
              <a href="mailto:support@hooklyapp.com" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
                      className="w-9 h-9 rounded-xl bg-white/4 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground"
                      title={link.platform}
                    >
                      {link.icon === 'twitter' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>}
                      {link.icon === 'linkedin' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>}
                      {link.icon === 'github' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>}
                      {link.icon === 'instagram' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>}
                      {link.icon === 'facebook' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                      {link.icon === 'whatsapp' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                      {link.icon === 'youtube' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>}
                      {link.icon === 'tiktok' && <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>}
                    </a>
                  ))
                ) : (
                  <>
                    <a href="#" className="w-9 h-9 rounded-xl bg-white/4 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                    </a>
                    <a href="#" className="w-9 h-9 rounded-xl bg-white/4 flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </a>
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-5 text-foreground text-sm">{t("footer.platform.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/como-funciona" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.platform.howItWorks")}</Link></li>
                <li><Link to="/talent-pool" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.platform.findTalent")}</Link></li>
                <li><Link to="/precos" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.platform.pricing")}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-5 text-foreground text-sm">{t("footer.company.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.company.about")}</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.company.careers")}</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.company.blog")}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-5 text-foreground text-sm">{t("footer.legal.title")}</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.legal.privacy")}</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.legal.terms")}</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/4 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
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
                    <DropdownMenuItem key={lang.code} onClick={() => changeLanguage(lang.code)} className="hover:bg-accent">
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
