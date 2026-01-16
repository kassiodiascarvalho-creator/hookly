import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Building2, User, Calendar, DollarSign, 
  CheckCircle, Clock, Loader2, AlertTriangle, Lock
} from "lucide-react";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { format } from "date-fns";
import { toast } from "sonner";

interface Milestone {
  title: string;
  amount: number;
  description?: string;
}

interface ContractData {
  id: string;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  deadline: string | null;
  milestones: Milestone[] | null;
  company_accepted_at: string | null;
  freelancer_accepted_at: string | null;
  created_at: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string;
}

interface CompanyInfo {
  company_name: string | null;
  contact_name: string | null;
  location: string | null;
}

interface FreelancerInfo {
  full_name: string | null;
  title: string | null;
  location: string | null;
}

interface ContractAcceptanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractData;
  onAccepted?: () => void;
}

export function ContractAcceptanceModal({
  open,
  onOpenChange,
  contract,
  onAccepted,
}: ContractAcceptanceModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [freelancerInfo, setFreelancerInfo] = useState<FreelancerInfo | null>(null);

  const isCompany = user?.id === contract.company_user_id;
  const isFreelancer = user?.id === contract.freelancer_user_id;
  
  const companyHasAccepted = !!contract.company_accepted_at;
  const freelancerHasAccepted = !!contract.freelancer_accepted_at;
  const bothAccepted = companyHasAccepted && freelancerHasAccepted;
  
  const userHasAccepted = isCompany ? companyHasAccepted : freelancerHasAccepted;
  const otherPartyAccepted = isCompany ? freelancerHasAccepted : companyHasAccepted;

  useEffect(() => {
    if (open) {
      fetchPartyInfo();
    }
  }, [open, contract]);

  const fetchPartyInfo = async () => {
    setLoadingInfo(true);

    // Fetch company info
    const { data: company } = await supabase
      .from("company_profiles")
      .select("company_name, contact_name, location")
      .eq("user_id", contract.company_user_id)
      .maybeSingle();

    if (company) {
      setCompanyInfo(company);
    }

    // Fetch freelancer info
    const { data: freelancer } = await supabase
      .from("freelancer_profiles")
      .select("full_name, title, location")
      .eq("user_id", contract.freelancer_user_id)
      .maybeSingle();

    if (freelancer) {
      setFreelancerInfo(freelancer);
    }

    setLoadingInfo(false);
  };

  const handleAccept = async () => {
    if (!termsAccepted || !user) return;

    setLoading(true);

    try {
      const updateField = isCompany ? "company_accepted_at" : "freelancer_accepted_at";
      
      // Check if both parties will have accepted after this
      const willBothAccept = isCompany ? freelancerHasAccepted : companyHasAccepted;
      
      const updateData: Record<string, unknown> = {
        [updateField]: new Date().toISOString(),
      };

      // If both accepted, change status to 'active'
      if (willBothAccept) {
        updateData.status = "active";
      } else {
        // Set to pending_acceptance if not already
        if (contract.status === "draft") {
          updateData.status = "pending_acceptance";
        }
      }

      const { error } = await supabase
        .from("contracts")
        .update(updateData)
        .eq("id", contract.id);

      if (error) throw error;

      toast.success(
        willBothAccept 
          ? "Contrato ativado! Ambas as partes aceitaram." 
          : "Contrato aceito! Aguardando a outra parte."
      );

      onAccepted?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Error accepting contract:", err);
      toast.error("Erro ao aceitar contrato");
    }

    setLoading(false);
  };

  const milestones = contract.milestones as Milestone[] | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato de Prestação de Serviços
          </DialogTitle>
          <DialogDescription>
            Revise os termos do contrato antes de aceitar
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {loadingInfo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg ${
                bothAccepted 
                  ? "bg-green-500/10 border border-green-500/20" 
                  : "bg-amber-500/10 border border-amber-500/20"
              }`}>
                <div className="flex items-center gap-3">
                  {bothAccepted ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {bothAccepted ? "Contrato Ativo" : "Aguardando Aceites"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {companyHasAccepted ? "✓ Empresa aceitou" : "○ Empresa pendente"} • 
                      {freelancerHasAccepted ? " ✓ Freelancer aceitou" : " ○ Freelancer pendente"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Contract Immutability Notice */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Valores fixos</p>
                  <p className="text-muted-foreground">
                    A moeda e o valor deste contrato não podem ser alterados após a criação.
                  </p>
                </div>
              </div>

              {/* Project Title */}
              <div>
                <h3 className="text-lg font-semibold">{contract.title}</h3>
                {contract.description && (
                  <p className="text-muted-foreground mt-1">{contract.description}</p>
                )}
              </div>

              <Separator />

              {/* Parties */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Contratante</span>
                    {companyHasAccepted && (
                      <Badge variant="default" className="gap-1 ml-auto">
                        <CheckCircle className="h-3 w-3" />
                        Aceito
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold">{companyInfo?.company_name || "Empresa"}</p>
                  {companyInfo?.contact_name && (
                    <p className="text-sm text-muted-foreground">{companyInfo.contact_name}</p>
                  )}
                  {companyInfo?.location && (
                    <p className="text-xs text-muted-foreground">{companyInfo.location}</p>
                  )}
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Prestador</span>
                    {freelancerHasAccepted && (
                      <Badge variant="default" className="gap-1 ml-auto">
                        <CheckCircle className="h-3 w-3" />
                        Aceito
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold">{freelancerInfo?.full_name || "Freelancer"}</p>
                  {freelancerInfo?.title && (
                    <p className="text-sm text-muted-foreground">{freelancerInfo.title}</p>
                  )}
                  {freelancerInfo?.location && (
                    <p className="text-xs text-muted-foreground">{freelancerInfo.location}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Financial Terms */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Condições Financeiras
                </h4>
                
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                    <p className="text-xl font-bold">
                      {formatMoneyFromCents(contract.amount_cents, contract.currency)}
                    </p>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">Moeda</p>
                    <p className="text-xl font-bold">{contract.currency}</p>
                  </div>
                </div>

                {contract.deadline && (
                  <div className="p-3 rounded-lg bg-muted flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo de Entrega</p>
                      <p className="font-medium">
                        {format(new Date(contract.deadline), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Milestones */}
              {milestones && milestones.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium">Marcos de Entrega</h4>
                    <div className="space-y-2">
                      {milestones.map((milestone, idx) => (
                        <div key={idx} className="p-3 rounded-lg border flex justify-between items-center">
                          <div>
                            <p className="font-medium">{milestone.title}</p>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground">{milestone.description}</p>
                            )}
                          </div>
                          <Badge variant="outline">
                            {formatMoneyFromCents(milestone.amount * 100, contract.currency)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Platform Terms */}
              <div className="space-y-3">
                <h4 className="font-medium">Termos da Plataforma</h4>
                <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-2">
                  <p>Ao aceitar este contrato, você concorda com:</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Os valores e moeda são fixos e não podem ser alterados</li>
                    <li>Pagamentos são processados através da plataforma</li>
                    <li>Disputas serão mediadas pela equipe de suporte</li>
                    <li>A plataforma retém uma taxa de serviço conforme termos de uso</li>
                    <li>Comunicações devem ser mantidas dentro da plataforma</li>
                  </ul>
                </div>
              </div>

              {/* Accept Terms Checkbox */}
              {!userHasAccepted && (
                <div className="flex items-start gap-3 p-4 rounded-lg border">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <label htmlFor="terms" className="text-sm cursor-pointer">
                    Li e aceito os termos deste contrato e da plataforma. Entendo que a moeda 
                    ({contract.currency}) e o valor ({formatMoneyFromCents(contract.amount_cents, contract.currency)}) 
                    são fixos e não negociáveis.
                  </label>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          
          {!userHasAccepted && (
            <Button 
              onClick={handleAccept} 
              disabled={!termsAccepted || loading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" />
              Aceitar Contrato
            </Button>
          )}

          {userHasAccepted && !bothAccepted && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Aguardando aceite da outra parte
            </div>
          )}

          {bothAccepted && (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Contrato Ativo
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}