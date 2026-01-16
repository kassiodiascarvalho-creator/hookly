import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Coins, Eye, Mail, Phone, Globe, Loader2, Lock, CheckCircle } from "lucide-react";
import { usePlatformCredits, PLATFORM_ACTIONS } from "@/hooks/usePlatformCredits";
import { CreditCheckModal } from "@/components/credits/CreditCheckModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompanyData {
  email: string | null;
  phone: string | null;
  website: string | null;
  company_name: string | null;
}

interface ViewCompanyDataButtonProps {
  companyUserId: string;
  companyName?: string | null;
}

export function ViewCompanyDataButton({ companyUserId, companyName }: ViewCompanyDataButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creditCheckOpen, setCreditCheckOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [hasUnlocked, setHasUnlocked] = useState(false);

  const { balance, spendCredits, getActionCost, loading: creditsLoading } = usePlatformCredits();
  const viewCost = getActionCost(PLATFORM_ACTIONS.VIEW_COMPANY_DATA);

  const handleViewData = async () => {
    // If already unlocked, just show dialog
    if (hasUnlocked && companyData) {
      setDialogOpen(true);
      return;
    }

    // Check credits
    if (viewCost > 0 && balance < viewCost) {
      setCreditCheckOpen(true);
      return;
    }

    setLoading(true);

    // Spend credits
    if (viewCost > 0) {
      const { success, error } = await spendCredits(
        PLATFORM_ACTIONS.VIEW_COMPANY_DATA,
        `Ver dados da empresa: ${companyName || companyUserId}`
      );

      if (!success) {
        toast.error(error || "Erro ao consumir créditos");
        setLoading(false);
        return;
      }
    }

    // Fetch company data
    try {
      // Get email from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", companyUserId)
        .maybeSingle();

      // Get phone and other data from company_profiles
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("phone, website, company_name")
        .eq("user_id", companyUserId)
        .maybeSingle();

      setCompanyData({
        email: profile?.email || null,
        phone: companyProfile?.phone || null,
        website: companyProfile?.website || null,
        company_name: companyProfile?.company_name || null,
      });

      setHasUnlocked(true);
      setDialogOpen(true);
      toast.success("Dados da empresa desbloqueados!");
    } catch (err) {
      console.error("Error fetching company data:", err);
      toast.error("Erro ao buscar dados da empresa");
    }

    setLoading(false);
  };

  return (
    <>
      <Button
        variant={hasUnlocked ? "outline" : "secondary"}
        size="sm"
        onClick={handleViewData}
        disabled={loading || creditsLoading}
        className="w-full gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : hasUnlocked ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {hasUnlocked ? "Ver Dados" : "Ver Dados da Empresa"}
        {!hasUnlocked && viewCost > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Coins className="h-3 w-3" />
            {viewCost}
          </Badge>
        )}
      </Button>

      {/* Company Data Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Dados da Empresa
            </DialogTitle>
            <DialogDescription>
              Informações de contato de {companyData?.company_name || companyName || "empresa"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Email */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">E-mail</p>
                {companyData?.email ? (
                  <a
                    href={`mailto:${companyData.email}`}
                    className="font-medium text-primary hover:underline break-all"
                  >
                    {companyData.email}
                  </a>
                ) : (
                  <p className="text-muted-foreground italic">Não informado</p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Telefone</p>
                {companyData?.phone ? (
                  <a
                    href={`tel:${companyData.phone}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {companyData.phone}
                  </a>
                ) : (
                  <p className="text-muted-foreground italic">Não informado</p>
                )}
              </div>
            </div>

            {/* Website */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Globe className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Website</p>
                {companyData?.website ? (
                  <a
                    href={companyData.website.startsWith("http") ? companyData.website : `https://${companyData.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline break-all"
                  >
                    {companyData.website}
                  </a>
                ) : (
                  <p className="text-muted-foreground italic">Não informado</p>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Esses dados são confidenciais. Use-os com responsabilidade.
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Check Modal */}
      <CreditCheckModal
        open={creditCheckOpen}
        onOpenChange={setCreditCheckOpen}
        actionName="Ver Dados da Empresa"
        requiredCredits={viewCost}
        currentBalance={balance}
      />
    </>
  );
}