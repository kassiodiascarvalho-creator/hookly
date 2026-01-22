import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, Building2, User, Calendar, DollarSign, 
  CheckCircle, Clock, Loader2, Lock, Shield, Scale,
  MessageSquare, Globe, AlertTriangle, FileCheck, Target,
  Wallet, XCircle, Users, Briefcase
} from "lucide-react";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const CONTRACT_VERSION = "v1.0";
const TERMS_VERSION = "1.0";

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
  accepted_at?: string | null;
  contract_terms_version?: string | null;
  created_at: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string;
  was_counterproposal?: boolean;
  agreed_amount_cents?: number | null;
  original_proposal_amount_cents?: number | null;
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

// Generate a simple hash for contract snapshot (Unicode-safe)
const generateContractHash = (contract: ContractData, companyInfo: CompanyInfo | null, freelancerInfo: FreelancerInfo | null): string => {
  const snapshotData = {
    id: contract.id,
    title: contract.title,
    description: contract.description,
    amount_cents: contract.amount_cents,
    currency: contract.currency,
    milestones: contract.milestones,
    company: companyInfo?.company_name,
    freelancer: freelancerInfo?.full_name,
    terms_version: TERMS_VERSION,
    contract_version: CONTRACT_VERSION,
  };
  
  const jsonString = JSON.stringify(snapshotData);
  
  // Simple hash using a checksum approach (Unicode-safe)
  let hash = 0;
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Return hex hash + length for integrity check
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hexHash}_${jsonString.length}`;
};

export function ContractAcceptanceModal({
  open,
  onOpenChange,
  contract,
  onAccepted,
}: ContractAcceptanceModalProps) {
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

  useEffect(() => {
    if (open) {
      fetchPartyInfo();
      setTermsAccepted(false);
    }
  }, [open, contract]);

  const fetchPartyInfo = async () => {
    setLoadingInfo(true);

    const [companyResult, freelancerResult] = await Promise.all([
      supabase
        .from("company_profiles")
        .select("company_name, contact_name, location")
        .eq("user_id", contract.company_user_id)
        .maybeSingle(),
      supabase
        .from("freelancer_profiles")
        .select("full_name, title, location")
        .eq("user_id", contract.freelancer_user_id)
        .maybeSingle()
    ]);

    if (companyResult.data) setCompanyInfo(companyResult.data);
    if (freelancerResult.data) setFreelancerInfo(freelancerResult.data);

    setLoadingInfo(false);
  };

  const handleAccept = async () => {
    if (!termsAccepted || !user) return;

    setLoading(true);

    try {
      const acceptRole = isCompany ? "company" : "freelancer";
      const updateField = isCompany ? "company_accepted_at" : "freelancer_accepted_at";
      const willBothAccept = isCompany ? freelancerHasAccepted : companyHasAccepted;
      const acceptedAt = new Date().toISOString();
      
      // Generate contract snapshot hash for audit trail
      const snapshotHash = generateContractHash(contract, companyInfo, freelancerInfo);
      
      // 1. First, record the acceptance in the audit table
      const { error: acceptanceError } = await supabase
        .from("contract_acceptances")
        .insert({
          contract_id: contract.id,
          accepted_by_user_id: user.id,
          accepted_by_role: acceptRole,
          accepted_at: acceptedAt,
          terms_version: TERMS_VERSION,
          contract_version: CONTRACT_VERSION,
          contract_snapshot_hash: snapshotHash,
          user_agent: navigator.userAgent,
        });

      // If duplicate (already accepted), just ignore and show message
      if (acceptanceError) {
        if (acceptanceError.code === "23505") {
          toast.info("Você já aceitou este contrato.");
          onOpenChange(false);
          setLoading(false);
          return;
        }
        throw acceptanceError;
      }

      // 2. Update contract status
      const updateData: Record<string, unknown> = {
        [updateField]: acceptedAt,
        contract_terms_version: CONTRACT_VERSION,
      };

      // Set status based on acceptance state
      if (willBothAccept) {
        // Both parties now accepted -> active
        updateData.status = "active";
        updateData.accepted_at = acceptedAt;
      } else {
        // Only one party accepted -> pending_acceptance
        updateData.status = "pending_acceptance";
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
  const contractId = contract.id.slice(0, 8).toUpperCase();

  const formatAcceptanceDate = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusBadge = () => {
    if (bothAccepted) return <Badge className="bg-green-600 text-white">Ativo</Badge>;
    if (contract.status === "pending_acceptance") return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">Pendente</Badge>;
    if (contract.status === "draft") return <Badge variant="outline">Rascunho</Badge>;
    return <Badge variant="outline">{contract.status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl w-[95vw] max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="flex-shrink-0 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base sm:text-lg truncate">
                  Contrato de Prestação de Serviços
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ID: #{contractId} • Versão {contract.contract_terms_version || CONTRACT_VERSION}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {loadingInfo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* CONTRACT SUMMARY */}
              <section className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                    Resumo do Contrato
                  </h3>
                  {contract.was_counterproposal && (
                    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500">
                      <AlertTriangle className="h-3 w-3" />
                      Contra-proposta
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-lg">{contract.title}</p>
                  
                  {/* Show counterproposal info if applicable */}
                  {contract.was_counterproposal && contract.original_proposal_amount_cents ? (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-amber-700 dark:text-amber-400">
                            Valor negociado via contra-proposta
                          </p>
                          <p className="text-muted-foreground mt-1">
                            Orçamento original: <span className="line-through">{formatMoneyFromCents(contract.original_proposal_amount_cents, contract.currency)}</span>
                            {" → "}
                            Valor acordado: <span className="font-semibold text-foreground">{formatMoneyFromCents(contract.amount_cents, contract.currency)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor: </span>
                      <span className="font-semibold">
                        {formatMoneyFromCents(contract.amount_cents, contract.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Moeda: </span>
                      <span className="font-semibold">{contract.currency}</span>
                    </div>
                    {contract.deadline && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Prazo: </span>
                        <span className="font-semibold">
                          {format(new Date(contract.deadline), "dd/MM/yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ACCEPTANCE STATUS */}
              <section className={`p-4 rounded-lg border ${
                bothAccepted 
                  ? "bg-green-500/10 border-green-500/30" 
                  : "bg-amber-500/10 border-amber-500/30"
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {bothAccepted ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600" />
                  )}
                  <span className="font-medium">
                    {bothAccepted ? "Contrato Ativo" : "Aceites Pendentes"}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {companyHasAccepted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      <strong>Contratante:</strong>{" "}
                      {companyHasAccepted 
                        ? `Aceito em ${formatAcceptanceDate(contract.company_accepted_at)}` 
                        : "Pendente"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {freelancerHasAccepted ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      <strong>Prestador:</strong>{" "}
                      {freelancerHasAccepted 
                        ? `Aceito em ${formatAcceptanceDate(contract.freelancer_accepted_at)}` 
                        : "Pendente"}
                    </span>
                  </div>
                </div>
              </section>

              <Separator />

              {/* SECTION 1: PARTES */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">1. Das Partes</h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">CONTRATANTE</span>
                    </div>
                    <p className="font-semibold">{companyInfo?.company_name || "Empresa"}</p>
                    {companyInfo?.contact_name && (
                      <p className="text-sm text-muted-foreground">Representante: {companyInfo.contact_name}</p>
                    )}
                    {companyInfo?.location && (
                      <p className="text-xs text-muted-foreground mt-1">{companyInfo.location}</p>
                    )}
                  </div>

                  <div className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-muted-foreground">PRESTADOR</span>
                    </div>
                    <p className="font-semibold">{freelancerInfo?.full_name || "Freelancer"}</p>
                    {freelancerInfo?.title && (
                      <p className="text-sm text-muted-foreground">{freelancerInfo.title}</p>
                    )}
                    {freelancerInfo?.location && (
                      <p className="text-xs text-muted-foreground mt-1">{freelancerInfo.location}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* SECTION 2: OBJETO E ESCOPO */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">2. Do Objeto e Escopo</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm space-y-4">
                  {/* Fixed legal text */}
                  <div className="p-3 rounded-md bg-muted/50 border-l-4 border-primary">
                    <p className="text-foreground leading-relaxed">
                      Este contrato tem por objeto a prestação de serviços pelo <strong>PRESTADOR</strong> ao{" "}
                      <strong>CONTRATANTE</strong>, conforme descrito no projeto e no escopo abaixo.{" "}
                      <span className="font-medium">
                        O escopo é vinculante e será usado para avaliação de entregas e eventuais disputas.
                      </span>
                    </p>
                  </div>
                  
                  {/* Dynamic project content */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Escopo do Projeto (conteúdo informado no projeto):
                    </p>
                    <div className="p-3 rounded-md border bg-background">
                      <p className="font-medium text-base mb-2">{contract.title}</p>
                      {contract.description ? (
                        <p className="text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {contract.description}
                        </p>
                      ) : (
                        <p className="text-muted-foreground italic">
                          Nenhuma descrição adicional fornecida.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3: ENTREGAS E MILESTONES */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">3. Das Entregas e Aceite</h4>
                </div>
                <div className="space-y-3">
                  {milestones && milestones.length > 0 ? (
                    <div className="space-y-2">
                      {milestones.map((milestone, idx) => (
                        <div key={idx} className="p-3 rounded-lg border bg-card flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm">
                              <span className="text-muted-foreground">{idx + 1}.</span> {milestone.title}
                            </p>
                            {milestone.description && (
                              <p className="text-xs text-muted-foreground mt-1">{milestone.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">
                            {formatMoneyFromCents(milestone.amount * 100, contract.currency)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-4 border rounded-lg bg-card">
                      A entrega será realizada em parcela única, conforme acordado entre as partes.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O aceite de cada entrega será realizado pelo CONTRATANTE através da plataforma.
                  </p>
                </div>
              </section>

              {/* SECTION 4: PREÇO E MOEDA */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">4. Do Preço e Moeda</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="text-xl font-bold">
                        {formatMoneyFromCents(contract.amount_cents, contract.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Moeda</p>
                      <p className="text-xl font-bold">{contract.currency}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 pt-2 border-t text-xs text-muted-foreground">
                    <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>Os valores e moeda são fixos e não podem ser alterados após a criação do contrato.</span>
                  </div>
                </div>
              </section>

              {/* SECTION 5: PAGAMENTO E ESCROW */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">5. Do Pagamento e Custódia (Escrow)</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm space-y-2">
                  <p>
                    Os pagamentos são processados exclusivamente através da plataforma, em sistema de custódia (escrow).
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>O CONTRATANTE deposita os valores antes do início de cada marco</li>
                    <li>Os valores ficam em custódia até a aprovação da entrega</li>
                    <li>Após aprovação, o pagamento é liberado ao PRESTADOR</li>
                    <li>A plataforma retém taxa de serviço conforme termos de uso</li>
                  </ul>
                </div>
              </section>

              {/* SECTION 6: CANCELAMENTO */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">6. Do Cancelamento e Rescisão</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm space-y-2 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">6.1.</strong> Antes do financiamento, qualquer parte pode solicitar o cancelamento sem ônus.
                  </p>
                  <p>
                    <strong className="text-foreground">6.2.</strong> Após o financiamento, o cancelamento estará sujeito à mediação da plataforma e 
                    eventuais reembolsos conforme trabalho já realizado.
                  </p>
                  <p>
                    <strong className="text-foreground">6.3.</strong> Em caso de abandono, a parte prejudicada deve abrir disputa em até 30 dias.
                  </p>
                </div>
              </section>

              {/* SECTION 7: DISPUTAS */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">7. Das Disputas</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm space-y-2 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">7.1.</strong> Qualquer disputa será mediada pela equipe de suporte da plataforma.
                  </p>
                  <p>
                    <strong className="text-foreground">7.2.</strong> O CONTRATANTE tem 7 dias para aprovar ou contestar cada entrega.
                  </p>
                  <p>
                    <strong className="text-foreground">7.3.</strong> A decisão da plataforma sobre disputas de pagamento é final e vinculante.
                  </p>
                </div>
              </section>

              {/* SECTION 8: PROPRIEDADE INTELECTUAL */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">8. Da Propriedade Intelectual</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                  <p>
                    A propriedade intelectual de todo trabalho produzido será transferida ao CONTRATANTE 
                    somente após o pagamento integral e aprovação de todas as entregas.
                  </p>
                </div>
              </section>

              {/* SECTION 9: CONFIDENCIALIDADE */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">9. Da Confidencialidade</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                  <p>
                    Ambas as partes concordam em manter sigilo sobre informações confidenciais trocadas 
                    durante a execução deste contrato, salvo autorização expressa ou exigência legal.
                  </p>
                </div>
              </section>

              {/* SECTION 10: LIMITAÇÃO DE RESPONSABILIDADE */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">10. Da Limitação de Responsabilidade</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                  <p>
                    A plataforma atua apenas como intermediadora e não se responsabiliza pela qualidade 
                    dos serviços prestados, cumprimento de prazos pelo PRESTADOR, ou decisões comerciais 
                    do CONTRATANTE.
                  </p>
                </div>
              </section>

              {/* SECTION 11: COMUNICAÇÃO */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">11. Da Comunicação</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                  <p>
                    Todas as comunicações relativas a este contrato devem ser realizadas exclusivamente 
                    através da plataforma, garantindo registro e rastreabilidade.
                  </p>
                </div>
              </section>

              {/* SECTION 12: FORO */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">12. Do Foro</h4>
                </div>
                <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                  <p>
                    Fica eleito o foro da sede da plataforma para dirimir quaisquer questões oriundas 
                    deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.
                  </p>
                </div>
              </section>

              <Separator />

              {/* CONTRACT METADATA */}
              <section className="text-xs text-muted-foreground space-y-1">
                <p>Contrato gerado em: {format(new Date(contract.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                <p>ID do Contrato: {contract.id}</p>
                <p>Versão dos Termos: {contract.contract_terms_version || CONTRACT_VERSION}</p>
              </section>
            </div>
          )}
        </div>

        {/* FIXED FOOTER */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
          {!userHasAccepted ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-0.5"
                />
                <label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                  Li e aceito integralmente os termos deste contrato ({CONTRACT_VERSION}). 
                  Declaro estar ciente que a moeda ({contract.currency}) e o valor 
                  ({formatMoneyFromCents(contract.amount_cents, contract.currency)}) são fixos.
                </label>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button 
                  onClick={handleAccept} 
                  disabled={!termsAccepted || loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Aceitar Contrato
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {bothAccepted ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Contrato ativo desde {formatAcceptanceDate(contract.accepted_at || contract.company_accepted_at)}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Aguardando aceite da outra parte</span>
                  </>
                )}
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
