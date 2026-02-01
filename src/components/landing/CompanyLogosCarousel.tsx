import { motion, useReducedMotion } from "framer-motion";

interface CompanyLogo {
  name: string;
  logo_url: string;
}

const COMPANY_LOGOS: CompanyLogo[] = [
  { name: "Meta", logo_url: "https://cdn.cdnlogo.com/logos/m/37/meta.svg" },
  { name: "Alphabet", logo_url: "https://cdn.cdnlogo.com/logos/a/75/alphabet.svg" },
  { name: "Coca-Cola", logo_url: "https://cdn.cdnlogo.com/logos/c/57/coca-cola.svg" },
  { name: "Amazon", logo_url: "https://cdn.cdnlogo.com/logos/a/19/amazon.svg" },
  { name: "Nvidia", logo_url: "https://cdn.cdnlogo.com/logos/n/27/nvidia.svg" },
  { name: "Apple", logo_url: "https://cdn.cdnlogo.com/logos/a/27/apple.svg" },
  { name: "Microsoft", logo_url: "https://cdn.cdnlogo.com/logos/m/87/microsoft.svg" },
  { name: "IBM", logo_url: "https://cdn.cdnlogo.com/logos/i/6/ibm.svg" },
  { name: "Adobe", logo_url: "https://cdn.cdnlogo.com/logos/a/72/adobe-2020.svg" },
  { name: "Google", logo_url: "https://cdn.cdnlogo.com/logos/g/35/google-2015.svg" },
  { name: "TikTok", logo_url: "https://cdn.cdnlogo.com/logos/t/25/tiktok-logo.svg" },
];

export function CompanyLogosCarousel() {
  const shouldReduceMotion = useReducedMotion();

  // Duplicate logos for infinite scroll effect
  const duplicatedLogos = [...COMPANY_LOGOS, ...COMPANY_LOGOS, ...COMPANY_LOGOS];

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
                    duration: 25,
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
              <img
                src={logo.logo_url}
                alt={logo.name}
                loading="lazy"
                className="h-6 md:h-8 w-auto grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 dark:brightness-150 dark:invert"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
