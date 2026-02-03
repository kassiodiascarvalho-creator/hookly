import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

interface NavbarProps {
  onOpenSignup: (type: "company" | "freelancer") => void;
}

export const Navbar = ({ onOpenSignup }: NavbarProps) => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: "/how-it-works", label: t("nav.howItWorks") },
    { to: "/for-companies", label: t("nav.forCompanies") },
    { to: "/for-freelancers", label: t("nav.forFreelancers") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/premiacao", label: t("nav.awards", "Premiação") },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost">{t("nav.login")}</Button>
          </Link>
          <Button onClick={() => onOpenSignup("company")}>{t("nav.signup")}</Button>
        </div>

        {/* Mobile Menu */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">{t("nav.login")}</Button>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] pt-12">
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors py-2 border-b border-border"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="pt-4">
                  <SheetClose asChild>
                    <Button 
                      className="w-full" 
                      onClick={() => onOpenSignup("company")}
                    >
                      {t("nav.signup")}
                    </Button>
                  </SheetClose>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};
