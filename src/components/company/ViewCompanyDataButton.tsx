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
import { 
  Coins, Eye, Mail, Phone, Globe, Loader2, Lock, CheckCircle,
  Briefcase, DollarSign, Users, Star, FileText
} from "lucide-react";
import { usePlatformCredits, PLATFORM_ACTIONS } from "@/hooks/usePlatformCredits";
import { CreditCheckModal } from "@/components/credits/CreditCheckModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoneyFromCents } from "@/lib/formatMoney";

interface CompanyData {
  email: string | null;
  phone: string | null;
  website: string | null;
  company_name: string | null;
  about: string | null;
  industry: string | null;
  location: string | null;
  company_size: string | null;
  logo_url: string | null;
  is_verified: boolean | null;
}

interface CompanyStats {
  totalContracts: number;
  totalPaidCents: number;
  freelancersHired: number;
  avgRating: number;
  reviewCount: number;
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
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
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

      // Get full company profile
      const { data: companyProfile } = await supabase
        .from("company_profiles")
        .select("phone, website, company_name, about, industry, location, company_size, logo_url, is_verified")
        .eq("user_id", companyUserId)
        .maybeSingle();

      setCompanyData({
        email: profile?.email || null,
        phone: companyProfile?.phone || null,
        website: companyProfile?.website || null,
        company_name: companyProfile?.company_name || null,
        about: companyProfile?.about || null,
        industry: companyProfile?.industry || null,
        location: companyProfile?.location || null,
        company_size: companyProfile?.company_size || null,
        logo_url: companyProfile?.logo_url || null,
        is_verified: companyProfile?.is_verified || null,
      });

      // Fetch stats: contracts
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, amount_cents, freelancer_user_id")
        .eq("company_user_id", companyUserId)
        .in("status", ["active", "funded", "completed"]);

      // Fetch reviews for this company
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("company_user_id", companyUserId);

      const totalPaidCents = contracts?.reduce((sum, c) => sum + (c.amount_cents || 0), 0) || 0;
      const freelancersHired = new Set(contracts?.map(c => c.freelancer_user_id)).size;
      const avgRating = reviews?.length 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0;

      setCompanyStats({
        totalContracts: contracts?.length || 0,
        totalPaidCents,
        freelancersHired,
        avgRating,
        reviewCount: reviews?.length || 0,
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Dados da Empresa
              {companyData?.is_verified && (
                <Badge variant="default" className="gap-1 ml-2">
                  <CheckCircle className="h-3 w-3" />
                  Verificada
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Informações completas de {companyData?.company_name || companyName || "empresa"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Stats Grid */}
            {companyStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contratos</p>
                    <p className="font-bold text-lg">{companyStats.totalContracts}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Pago</p>
                    <p className="font-bold text-lg">{formatMoneyFromCents(companyStats.totalPaidCents, "USD")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Freelancers</p>
                    <p className="font-bold text-lg">{companyStats.freelancersHired}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Star className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avaliação</p>
                    <p className="font-bold text-lg">
                      {companyStats.avgRating > 0 
                        ? `${companyStats.avgRating.toFixed(1)} (${companyStats.reviewCount})` 
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Company Info */}
            {(companyData?.industry || companyData?.location || companyData?.company_size) && (
              <div className="flex flex-wrap gap-2">
                {companyData?.industry && (
                  <Badge variant="outline" className="gap-1">
                    <Briefcase className="h-3 w-3" />
                    {companyData.industry}
                  </Badge>
                )}
                {companyData?.location && (
                  <Badge variant="outline">{companyData.location}</Badge>
                )}
                {companyData?.company_size && (
                  <Badge variant="outline" className="gap-1">
                    <Users className="h-3 w-3" />
                    {companyData.company_size}
                  </Badge>
                )}
              </div>
            )}

            {/* About */}
            {companyData?.about && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Sobre</p>
                <p className="text-sm">{companyData.about}</p>
              </div>
            )}

            {/* Contact Details */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Contato</p>
              
              {/* Email */}
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">E-mail</p>
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
                  <p className="text-xs text-muted-foreground">Telefone</p>
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
                  <p className="text-xs text-muted-foreground">Website</p>
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