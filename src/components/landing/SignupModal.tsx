import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, User } from "lucide-react";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "company" | "freelancer";
}

export const SignupModal = ({ isOpen, onClose, type }: SignupModalProps) => {
  const navigate = useNavigate();

  const handleContinue = () => {
    onClose();
    navigate(`/auth?type=${type}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "company" ? (
              <>
                <Building2 className="w-5 h-5 text-primary" />
                Cadastro para Empresas
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-primary" />
                Cadastro para Freelancers
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "company"
              ? "Encontre os melhores talentos para seus projetos com segurança e praticidade."
              : "Acesse oportunidades incríveis e receba pagamentos de forma segura."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">
              {type === "company" ? "Benefícios para Empresas" : "Benefícios para Freelancers"}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {type === "company" ? (
                <>
                  <li>• Acesso a freelancers verificados</li>
                  <li>• Pagamentos protegidos por escrow</li>
                  <li>• Suporte dedicado</li>
                </>
              ) : (
                <>
                  <li>• Projetos de qualidade</li>
                  <li>• Pagamentos garantidos</li>
                  <li>• Construa sua reputação</li>
                </>
              )}
            </ul>
          </div>
          
          <Button onClick={handleContinue} className="w-full">
            Continuar Cadastro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
