import { motion, useReducedMotion } from "framer-motion";

interface CompanyLogo {
  name: string;
  logo_url: string;
}

const COMPANY_LOGOS: CompanyLogo[] = [
  { name: "Meta", logo_url: "https://logo.clearbit.com/meta.com" },
  { name: "Alphabet", logo_url: "https://logo.clearbit.com/abc.xyz" },
  { name: "Coca-Cola", logo_url: "https://logo.clearbit.com/coca-cola.com" },
  { name: "Amazon", logo_url: "https://logo.clearbit.com/amazon.com" },
  { name: "Nvidia", logo_url: "https://logo.clearbit.com/nvidia.com" },
  { name: "Apple", logo_url: "https://logo.clearbit.com/apple.com" },
  { name: "Microsoft", logo_url: "https://logo.clearbit.com/microsoft.com" },
  { name: "IBM", logo_url: "https://logo.clearbit.com/ibm.com" },
  { name: "Adobe", logo_url: "https://logo.clearbit.com/adobe.com" },
  { name: "Google", logo_url: "https://logo.clearbit.com/google.com" },
  { name: "TikTok", logo_url: "https://logo.clearbit.com/tiktok.com" },
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
                    duration: 24,
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
