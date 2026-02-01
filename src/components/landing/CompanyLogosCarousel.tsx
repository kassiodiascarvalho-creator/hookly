import { useState } from "react";

interface CompanyLogo {
  name: string;
  logo_url: string;
}

const COMPANY_LOGOS: CompanyLogo[] = [
  { name: "Meta", logo_url: "/logos/companies/meta.png" },
  { name: "Alphabet", logo_url: "/logos/companies/alphabet.png" },
  { name: "Coca-Cola", logo_url: "/logos/companies/coca-cola.png" },
  { name: "Amazon", logo_url: "/logos/companies/amazon.png" },
  { name: "Nvidia", logo_url: "/logos/companies/nvidia.png" },
  { name: "Apple", logo_url: "/logos/companies/apple.png" },
  { name: "Microsoft", logo_url: "/logos/companies/microsoft.svg" },
  { name: "IBM", logo_url: "/logos/companies/ibm.png" },
  { name: "Adobe", logo_url: "/logos/companies/adobe.svg" },
  { name: "Google", logo_url: "/logos/companies/google.svg" },
  { name: "TikTok", logo_url: "/logos/companies/tiktok.png" },
];

export function CompanyLogosCarousel() {
  const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);

  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...COMPANY_LOGOS, ...COMPANY_LOGOS];

  const handleImageError = (logoName: string) => {
    setFailedLogos((prev) => new Set(prev).add(logoName));
  };

  const handleLogoClick = (uniqueKey: string) => {
    setSelectedLogo((prev) => (prev === uniqueKey ? null : uniqueKey));
  };

  return (
    <div className="py-8 relative overflow-hidden">
      <style>{`
        @keyframes scroll-logos {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll-logos {
          animation: scroll-logos 30s linear infinite;
        }
        .animate-scroll-logos:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="relative w-full overflow-hidden mask-gradient-x">
        <div className="flex gap-16 items-center animate-scroll-logos">
          {duplicatedLogos.map((logo, index) => {
            const uniqueKey = `${logo.name}-${index}`;
            if (failedLogos.has(logo.name)) {
              return null;
            }

            const isSelected = selectedLogo === uniqueKey;

            return (
              <div
                key={uniqueKey}
                className="flex-shrink-0 px-4 cursor-pointer"
                onClick={() => handleLogoClick(uniqueKey)}
              >
                <img
                  src={logo.logo_url}
                  alt={logo.name}
                  loading="lazy"
                  onError={() => handleImageError(logo.name)}
                  className={`h-8 md:h-12 w-auto max-w-[120px] md:max-w-[160px] object-contain transition-all duration-300 ${
                    isSelected
                      ? "scale-125"
                      : "hover:scale-110"
                  }`}
                  style={{
                    filter: isSelected 
                      ? 'none' 
                      : 'grayscale(100%) opacity(0.7) brightness(1.6) contrast(0.6)'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
