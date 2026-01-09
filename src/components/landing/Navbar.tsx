import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

interface NavbarProps {
  onOpenSignup: (type: "company" | "freelancer") => void;
}

export const Navbar = ({ onOpenSignup }: NavbarProps) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
            Como Funciona
          </Link>
          <Link to="/for-companies" className="text-muted-foreground hover:text-foreground transition-colors">
            Para Empresas
          </Link>
          <Link to="/for-freelancers" className="text-muted-foreground hover:text-foreground transition-colors">
            Para Freelancers
          </Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            Preços
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost">Entrar</Button>
          </Link>
          <Button onClick={() => onOpenSignup("company")}>Começar Grátis</Button>
        </div>
      </div>
    </nav>
  );
};
