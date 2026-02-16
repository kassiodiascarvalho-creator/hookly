import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface Talent {
  name: string;
  role: string;
  rating: number;
  successRate: string;
  rate: string;
  portfolioImages: string[];
  avatarUrl: string;
  category: string;
}

const TALENTS: Talent[] = [
  {
    name: "Lucas Mendes",
    role: "React / Node.js",
    rating: 4.9,
    successRate: "97%",
    rate: "R$80-120/h",
    portfolioImages: ["/portfolio/dev-workspace-1.jpg", "/portfolio/fullstack-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg",
    category: "development",
  },
  {
    name: "Carla Ribeiro",
    role: "UI/UX Designer",
    rating: 5.0,
    successRate: "100%",
    rate: "R$90/h",
    portfolioImages: ["/portfolio/design-workspace-1.jpg", "/portfolio/marketing-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
    category: "design",
  },
  {
    name: "Pedro Santos",
    role: "Growth Marketing",
    rating: 4.8,
    successRate: "95%",
    rate: "R$70/h",
    portfolioImages: ["/portfolio/data-workspace-1.jpg", "/portfolio/marketing-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/men/45.jpg",
    category: "marketing",
  },
  {
    name: "Ana Lucia",
    role: "Python / ML",
    rating: 4.9,
    successRate: "98%",
    rate: "R$100/h",
    portfolioImages: ["/portfolio/ml-workspace-1.jpg", "/portfolio/data-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg",
    category: "data",
  },
  {
    name: "Rafael Costa",
    role: "Full-Stack Dev",
    rating: 4.7,
    successRate: "94%",
    rate: "R$85/h",
    portfolioImages: ["/portfolio/fullstack-workspace-1.jpg", "/portfolio/dev-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/men/52.jpg",
    category: "development",
  },
  {
    name: "Julia Ferreira",
    role: "Brand Designer",
    rating: 5.0,
    successRate: "99%",
    rate: "R$95/h",
    portfolioImages: ["/portfolio/design-workspace-1.jpg", "/portfolio/marketing-workspace-1.jpg"],
    avatarUrl: "https://randomuser.me/api/portraits/women/26.jpg",
    category: "design",
  },
];

const CATEGORIES = ["all", "development", "design", "marketing", "data"];

export function TalentGallery() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("all");

  const categoryLabels: Record<string, string> = {
    all: t("landing.talents.all", "Todos"),
    development: t("landing.talents.dev", "Desenvolvimento"),
    design: t("landing.talents.design", "Design"),
    marketing: t("landing.talents.marketing", "Marketing"),
    data: t("landing.talents.data", "Data Science"),
  };

  const filtered = activeCategory === "all"
    ? TALENTS
    : TALENTS.filter((t) => t.category === activeCategory);

  return (
    <section className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t("landing.talents.title", "Talentos prontos para seu projeto")}
          </h2>
        </motion.div>

        {/* Category filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Talent grid / mobile carousel */}
        <div className={
          isMobile
            ? "flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-6 scrollbar-hide"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
        }>
          {filtered.map((talent, i) => (
            <motion.div
              key={talent.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`group surface-card overflow-hidden hover:border-primary/30 transition-all duration-300 ${
                isMobile ? "w-[75vw] min-w-[75vw] snap-center flex-shrink-0" : ""
              }`}
            >
              {/* Portfolio thumbnails */}
              <div className="relative h-40 flex">
                {talent.portfolioImages.map((img, j) => (
                  <div key={j} className="flex-1 overflow-hidden">
                    <img
                      src={img}
                      alt={`${talent.name} portfolio ${j + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>

              {/* Avatar overlapping */}
              <div className="relative px-4 pb-4">
                <div className="absolute -top-6 left-4">
                  <img
                    src={talent.avatarUrl}
                    alt={talent.name}
                    className="w-12 h-12 rounded-full border-2 border-card object-cover"
                  />
                </div>

                <div className="pt-8">
                  <h3 className="font-semibold text-foreground text-sm">{talent.name}</h3>
                  <p className="text-xs text-primary mb-2">{talent.role}</p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      {talent.rating}
                    </span>
                    <span>{talent.successRate} sucesso</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">{talent.rate}</span>
                    <Link to="/auth" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      Ver perfil <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link to="/talent-pool">
            <Button variant="outline" className="border-border hover:bg-accent gap-2">
              {t("landing.talents.viewAll", "Explorar todos os 2.400+ talentos")} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
