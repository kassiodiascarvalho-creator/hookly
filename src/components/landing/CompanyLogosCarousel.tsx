import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

interface CompanyLogo {
  name: string;
  logo_url: string;
}

const COMPANY_LOGOS: CompanyLogo[] = [
  { name: "Meta", logo_url: "/logos/companies/meta.svg" },
  { name: "Alphabet", logo_url: "/logos/companies/alphabet.png" },
  { name: "Coca-Cola", logo_url: "/logos/companies/coca-cola.png" },
  { name: "Amazon", logo_url: "/logos/companies/amazon.png" },
  { name: "Nvidia", logo_url: "/logos/companies/nvidia.png" },
  { name: "Apple", logo_url: "/logos/companies/apple.png" },
  { name: "Microsoft", logo_url: "/logos/companies/microsoft.svg" },
  { name: "IBM", logo_url: "/logos/companies/ibm.svg" },
  { name: "Adobe", logo_url: "/logos/companies/adobe.svg" },
  { name: "Google", logo_url: "/logos/companies/google.svg" },
  { name: "TikTok", logo_url: "/logos/companies/tiktok.png" },
];

export function CompanyLogosCarousel() {
  const shouldReduceMotion = useReducedMotion();
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [selectedApple, setSelectedApple] = useState<string | null>(null);

  // Duplicate logos for infinite scroll effect
  const duplicatedLogos = [...COMPANY_LOGOS, ...COMPANY_LOGOS, ...COMPANY_LOGOS];

  const handleImageError = (logoName: string) => {
    setFailedLogos((prev) => new Set(prev).add(logoName));
  };

  const handleAppleClick = (uniqueKey: string, logoName: string) => {
    if (logoName === "Apple") {
      setSelectedApple((prev) => (prev === uniqueKey ? null : uniqueKey));
    }
  };

  return (
    <div className="py-8 relative overflow-hidden">
      <div className="relative w-full overflow-hidden mask-gradient-x">
        <motion.div
          className="flex gap-16 items-center"
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
                    duration: 23,
                    repeat: Infinity,
                    ease: "linear",
                  },
                }
          }
        >
          {duplicatedLogos.map((logo, index) => {
            const uniqueKey = `${logo.name}-${index}`;
            if (failedLogos.has(logo.name)) {
              return null; // Hide failed logos
            }

            const isApple = logo.name === "Apple";
            const isAppleSelected = selectedApple === uniqueKey;

            return (
              <div
                key={uniqueKey}
                className="flex-shrink-0 px-4"
                onClick={() => handleAppleClick(uniqueKey, logo.name)}
                style={{ cursor: isApple ? "pointer" : "default" }}
              >
                <img
                  src={logo.logo_url}
                  alt={logo.name}
                  loading="lazy"
                  onError={() => handleImageError(logo.name)}
                  className={`h-10 md:h-14 w-auto transition-all duration-300 ${
                    isAppleSelected
                      ? "grayscale-0 opacity-100 scale-150 brightness-110"
                      : "grayscale opacity-60 hover:grayscale-0 hover:opacity-100"
                  } dark:brightness-150 dark:invert dark:contrast-150`}
                />
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
