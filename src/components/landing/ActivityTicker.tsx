import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Star, CheckCircle, Rocket, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface Activity {
  icon: "star" | "check" | "rocket";
  name: string;
  action: string;
  detail: string;
}

const ICONS = {
  star: Star,
  check: CheckCircle,
  rocket: Rocket,
};

export function ActivityTicker() {
  const { t } = useTranslation();
  const [visibleIndex, setVisibleIndex] = useState(0);

  const activities: Activity[] = [
    { icon: "check", name: "João P.", action: t("landing.ticker.delivered", "entregou"), detail: t("landing.ticker.uiDesign", "projeto de UI Design") },
    { icon: "check", name: "Maria S.", action: t("landing.ticker.received", "recebeu"), detail: "R$4.500" },
    { icon: "rocket", name: "Tech Corp", action: t("landing.ticker.hired", "contratou"), detail: t("landing.ticker.threeDevs", "3 devs em 2 dias") },
    { icon: "star", name: "Pedro L.", action: t("landing.ticker.completed", "completou"), detail: t("landing.ticker.appMobile", "app mobile") },
    { icon: "check", name: "Ana R.", action: t("landing.ticker.received", "recebeu"), detail: "R$8.200" },
    { icon: "rocket", name: "StartupXYZ", action: t("landing.ticker.hired", "contratou"), detail: t("landing.ticker.designer", "designer UX sênior") },
    { icon: "star", name: "Carlos M.", action: t("landing.ticker.delivered", "entregou"), detail: t("landing.ticker.ecommerce", "e-commerce completo") },
    { icon: "check", name: "Laura B.", action: t("landing.ticker.received", "recebeu"), detail: "R$12.000" },
  ];

  // Triplicate for infinite scroll
  const allActivities = [...activities, ...activities, ...activities];

  return (
    <section className="py-10 relative overflow-hidden border-y border-border/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {t("landing.ticker.title", "Acontecendo agora na HOOKLY")}
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        </div>
      </div>

      <style>{`
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-scroll-ticker {
          animation: scroll-ticker 30s linear infinite;
          will-change: transform;
        }
        .animate-scroll-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="relative w-full overflow-hidden mask-gradient-x">
        <div className="flex gap-4 items-stretch animate-scroll-ticker" style={{ width: "max-content" }}>
          {allActivities.map((activity, i) => {
            const Icon = ICONS[activity.icon];
            return (
              <div
                key={i}
                className="flex-shrink-0 surface-card p-4 min-w-[220px] hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{activity.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {activity.action} {activity.detail}
                </p>
                <div className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary font-medium">
                    {activity.icon === "star" ? "⭐⭐⭐⭐⭐" : activity.icon === "check" ? "✅ Pago" : "🚀 Ativo"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="container mx-auto px-4 mt-4">
        <p className="text-xs text-muted-foreground/60 text-left">
          <span className="text-primary font-semibold">+2.847</span> {t("landing.ticker.statLabel", "projetos completados este mês")}
        </p>
      </div>
    </section>
  );
}
