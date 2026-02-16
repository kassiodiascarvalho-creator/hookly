import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";

export function StickyMobileCTA() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border p-3">
      <Link to="/auth" className="block">
        <Button className="w-full btn-gradient gap-2 py-5">
          <Rocket className="h-4 w-4" />
          {t("hero.cta", "Começar Grátis")}
        </Button>
      </Link>
    </div>
  );
}
