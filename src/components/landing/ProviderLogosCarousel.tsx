import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle, MessageSquare, ShieldCheck } from "lucide-react";

interface ProviderLogo {
  name: string;
  logo_url: string;
  href?: string;
}

const trustBadges = [
  { icon: Shield, key: "escrow" },
  { icon: CheckCircle, key: "approval" },
  { icon: MessageSquare, key: "secureChat" },
  { icon: ShieldCheck, key: "antiFraud" },
];

export function ProviderLogosCarousel() {
  const { t } = useTranslation();
  const [logos, setLogos] = useState<ProviderLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "landing.provider_logos")
          .maybeSingle();

        if (!error && data?.value) {
          const logosArray = data.value as unknown as ProviderLogo[];
          if (Array.isArray(logosArray)) {
            setLogos(logosArray);
          }
        }
      } catch (err) {
        console.error("Error fetching provider logos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogos();
  }, []);

  // Duplicate logos for infinite scroll effect
  const duplicatedLogos = [...logos, ...logos, ...logos];

  if (loading || logos.length === 0) {
    return null;
  }

  return (
    <section className="py-16 relative overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">
            {t("landing.providers.title")}
          </h2>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            {t("landing.providers.subtitle")}
          </p>
        </motion.div>

        {/* Logo Carousel */}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden mask-gradient-x mb-6"
        >
          <motion.div
            className="flex gap-12 items-center"
            animate={
              shouldReduceMotion
                ? {}
                : {
                    x: ["0%", "-33.33%"],
                  }
            }
            transition={
              shouldReduceMotion
                ? {}
                : {
                    x: {
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }
            }
          >
            {duplicatedLogos.map((logo, index) => (
              <div
                key={`${logo.name}-${index}`}
                className="flex-shrink-0 px-4"
              >
                {logo.href ? (
                  <a
                    href={logo.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={logo.logo_url}
                      alt={logo.name}
                      loading="lazy"
                      className="h-8 md:h-10 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  </a>
                ) : (
                  <img
                    src={logo.logo_url}
                    alt={logo.name}
                    loading="lazy"
                    className="h-8 md:h-10 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                  />
                )}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-muted-foreground/60 mb-12">
          {t("landing.providers.disclaimer")}
        </p>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {trustBadges.map((badge) => (
            <div
              key={badge.key}
              className="surface-card p-4 text-center group hover:border-primary/30 transition-all duration-300"
            >
              <badge.icon className="h-6 w-6 text-primary mx-auto mb-2 opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-xs md:text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t(`landing.providers.badges.${badge.key}`)}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
