import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
                {t("signupModal.companyTitle", "Sign Up as a Company")}
              </>
            ) : (
              <>
                <User className="w-5 h-5 text-primary" />
                {t("signupModal.freelancerTitle", "Sign Up as a Freelancer")}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === "company"
              ? t("signupModal.companyDescription", "Find the best talent for your projects with security and convenience.")
              : t("signupModal.freelancerDescription", "Access amazing opportunities and receive payments securely.")}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">
              {type === "company" 
                ? t("signupModal.companyBenefitsTitle", "Benefits for Companies") 
                : t("signupModal.freelancerBenefitsTitle", "Benefits for Freelancers")}
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {type === "company" ? (
                <>
                  <li>• {t("signupModal.companyBenefit1", "Access to verified freelancers")}</li>
                  <li>• {t("signupModal.companyBenefit2", "Payments protected by escrow")}</li>
                  <li>• {t("signupModal.companyBenefit3", "Dedicated support")}</li>
                </>
              ) : (
                <>
                  <li>• {t("signupModal.freelancerBenefit1", "Quality projects")}</li>
                  <li>• {t("signupModal.freelancerBenefit2", "Guaranteed payments")}</li>
                  <li>• {t("signupModal.freelancerBenefit3", "Build your reputation")}</li>
                </>
              )}
            </ul>
          </div>
          
          <Button onClick={handleContinue} className="w-full">
            {t("signupModal.continue", "Continue Sign Up")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};