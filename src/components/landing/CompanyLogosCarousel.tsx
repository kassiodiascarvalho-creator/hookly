import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

interface CompanyLogo {
  name: string;
  logo_url: string;
}

const COMPANY_LOGOS: CompanyLogo[] = [
  { name: "Meta", logo_url: "/logos/companies/meta.svg" },
  { name: "Alphabet", logo_url: "/logos/companies/alphabet.svg" },
  { name: "Coca-Cola", logo_url: "/logos/companies/coca-cola.svg" },
  { name: "Amazon", logo_url: "/logos/companies/amazon.svg" },
  { name: "Nvidia", logo_url: "/logos/companies/nvidia.svg" },
  { name: "Apple", logo_url: "/logos/companies/apple.svg" },
  { name: "Microsoft", logo_url: "/logos/companies/microsoft.svg" },
  { name: "IBM", logo_url: "/logos/companies/ibm.svg" },
  { name: "Adobe", logo_url: "/logos/companies/adobe.svg" },
  { name: "Google", logo_url: "/logos/companies/google.svg" },
  { name: "TikTok", logo_url: "/logos/companies/tiktok.svg" },
];

export function CompanyLogosCarousel() {
  const shouldReduceMotion = useReducedMotion();
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());

  // Duplicate logos for infinite scroll effect
  const duplicatedLogos = [...COMPANY_LOGOS, ...COMPANY_LOGOS, ...COMPANY_LOGOS];

  const handleImageError = (logoName: string) => {
    setFailedLogos((prev) => new Set(prev).add(logoName));
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
            return (
              <div
                key={uniqueKey}
                className="flex-shrink-0 px-4"
              >
                <img
                  src={logo.logo_url}
                  alt={logo.name}
                  loading="lazy"
                  onError={() => handleImageError(logo.name)}
                  className="h-6 md:h-8 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 dark:brightness-150"
                />
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
