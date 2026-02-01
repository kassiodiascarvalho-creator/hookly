import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="py-12 px-4 border-t border-border">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-muted-foreground">
              {t("footer.description")}
            </p>
            <a 
              href="mailto:support@hooklyapp.com" 
              className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>support@hooklyapp.com</span>
            </a>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t("footer.platform.title")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/how-it-works" className="hover:text-foreground transition-colors">{t("footer.platform.howItWorks")}</Link></li>
              <li><Link to="/pricing" className="hover:text-foreground transition-colors">{t("footer.platform.pricing")}</Link></li>
              <li><Link to="/for-companies" className="hover:text-foreground transition-colors">{t("footer.platform.findTalent")}</Link></li>
              <li><Link to="/for-freelancers" className="hover:text-foreground transition-colors">{t("footer.platform.findProjects")}</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t("footer.resources.title")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.resources.help")}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.resources.guides")}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.legal.terms")}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.legal.privacy")}</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">{t("footer.company.title")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.company.about")}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.company.careers")}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{t("footer.company.blog")}</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          {t("footer.copyright")}
        </div>
      </div>
    </footer>
  );
};