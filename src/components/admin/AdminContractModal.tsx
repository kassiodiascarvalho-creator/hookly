import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, Building2, User, Calendar, 
  CheckCircle, Clock, Loader2, Lock, Shield, Scale,
  MessageSquare, Globe, AlertTriangle, FileCheck, Target,
  Wallet, XCircle, Users, Briefcase, Copy, X, Hash
} from "lucide-react";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  accepted_at: string | null;
  contract_terms_version: string | null;
  created_at: string;
  company_user_id: string;
  freelancer_user_id: string;
  project_id: string;
}

interface CompanyInfo {
  company_name: string | null;
  contact_name: string | null;
  location: string | null;
  user_id: string;
}

interface FreelancerInfo {
  full_name: string | null;
  title: string | null;
  location: string | null;
  user_id: string;
}

interface ContractAcceptance {
  id: string;
  contract_id: string;
  accepted_by_user_id: string;
  accepted_by_role: string;
  accepted_at: string;
  terms_version: string;
  contract_version: string;
  contract_snapshot_hash: string;
  user_agent: string | null;
}

interface AdminContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
}

const CONTRACT_VERSION = "v1.0";

export function AdminContractModal({
  open,
  onOpenChange,
  projectId,
  projectTitle,
}: AdminContractModalProps) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractData | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [freelancerInfo, setFreelancerInfo] = useState<FreelancerInfo | null>(null);
  const [acceptances, setAcceptances] = useState<ContractAcceptance[]>([]);

  useEffect(() => {
    if (open) {
      fetchContractData();
    }
  }, [open, projectId]);

  const fetchContractData = async () => {
    setLoading(true);
    setContract(null);
    setCompanyInfo(null);
    setFreelancerInfo(null);
    setAcceptances([]);

    try {
      // Fetch contract for this project
      const { data: contractData, error: contractError } = await supabase
        .from("contracts")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (contractError) throw contractError;

      if (!contractData) {
        setLoading(false);
        return;
      }

      // Cast milestones properly from Json type
      const typedContract: ContractData = {
        ...contractData,
        milestones: Array.isArray(contractData.milestones) 
          ? (contractData.milestones as unknown as Milestone[]) 
          : null,
      };

      setContract(typedContract);

      // Fetch company, freelancer info, and acceptances in parallel
      const [companyResult, freelancerResult, acceptancesResult] = await Promise.all([
        supabase
          .from("company_profiles")
          .select("company_name, contact_name, location, user_id")
          .eq("user_id", contractData.company_user_id)
          .maybeSingle(),
        supabase
          .from("freelancer_profiles")
          .select("full_name, title, location, user_id")
          .eq("user_id", contractData.freelancer_user_id)
          .maybeSingle(),
        supabase
          .from("contract_acceptances")
          .select("*")
          .eq("contract_id", contractData.id)
          .order("accepted_at", { ascending: true })
      ]);

      if (companyResult.data) setCompanyInfo(companyResult.data);
      if (freelancerResult.data) setFreelancerInfo(freelancerResult.data);
      if (acceptancesResult.data) setAcceptances(acceptancesResult.data);

    } catch (error) {
      console.error("Error fetching contract data:", error);
      toast.error("Erro ao carregar dados do contrato");
    }

    setLoading(false);
  };

  const copyContractId = () => {
    if (contract) {
      navigator.clipboard.writeText(contract.id);
      toast.success("ID do contrato copiado!");
    }
  };

  const formatAcceptanceDate = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-600 text-white">Ativo</Badge>;
      case "pending_acceptance":
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">Pendente</Badge>;
      case "draft":
        return <Badge variant="outline">Rascunho</Badge>;
      case "funded":
        return <Badge className="bg-blue-600 text-white">Financiado</Badge>;
      case "completed":
        return <Badge className="bg-primary text-primary-foreground">Concluído</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAcceptanceForRole = (role: string) => {
    return acceptances.find(a => a.accepted_by_role === role);
  };

  const milestones = contract?.milestones as Milestone[] | null;
  const contractId = contract?.id.slice(0, 8).toUpperCase() || "";

  const companyAcceptance = getAcceptanceForRole("company");
  const freelancerAcceptance = getAcceptanceForRole("freelancer");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-3xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="flex-shrink-0 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base sm:text-lg">
                  Contrato do Projeto
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {projectTitle}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !contract ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Sem contrato criado</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Este projeto ainda não possui um contrato associado. 
                  O contrato é criado quando uma proposta é aceita.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* CONTRACT HEADER INFO */}
                <section className="p-4 rounded-lg bg-muted/50 border">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">ID do Contrato</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                          #{contractId}
                        </code>
                        <Button variant="ghost" size="sm" onClick={copyContractId} className="h-7 w-7 p-0">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                      <div>{getStatusBadge(contract.status)}</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Versão do Contrato</p>
                      <p className="text-sm font-medium">{contract.contract_terms_version || CONTRACT_VERSION}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Criado em</p>
                      <p className="text-sm">{format(new Date(contract.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor Total</p>
                      <p className="text-sm font-semibold">
                        {formatMoneyFromCents(contract.amount_cents, contract.currency)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Moeda</p>
                      <p className="text-sm font-medium">{contract.currency}</p>
                    </div>
                  </div>
                </section>

                {/* ACCEPTANCES / SIGNATURES */}
                <section className={`p-4 rounded-lg border ${
                  contract.status === "active" || contract.status === "funded" || contract.status === "completed"
                    ? "bg-green-500/10 border-green-500/30" 
                    : "bg-amber-500/10 border-amber-500/30"
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Assinaturas / Aceites</h3>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Company Acceptance */}
                    <div className="p-3 rounded-lg bg-background border">
                      <div className="flex items-start gap-3">
                        {companyAcceptance ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Contratante</span>
                            {companyInfo?.company_name && (
                              <span className="text-sm text-muted-foreground">({companyInfo.company_name})</span>
                            )}
                          </div>
                          {companyAcceptance ? (
                            <div className="mt-1 space-y-1">
                              <p className="text-sm text-green-600">
                                Aceito em {formatAcceptanceDate(companyAcceptance.accepted_at)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                User ID: {companyAcceptance.accepted_by_user_id.slice(0, 8)}...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Terms: {companyAcceptance.terms_version} | Contract: {companyAcceptance.contract_version}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">Pendente</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Freelancer Acceptance */}
                    <div className="p-3 rounded-lg bg-background border">
                      <div className="flex items-start gap-3">
                        {freelancerAcceptance ? (
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Prestador</span>
                            {freelancerInfo?.full_name && (
                              <span className="text-sm text-muted-foreground">({freelancerInfo.full_name})</span>
                            )}
                          </div>
                          {freelancerAcceptance ? (
                            <div className="mt-1 space-y-1">
                              <p className="text-sm text-green-600">
                                Aceito em {formatAcceptanceDate(freelancerAcceptance.accepted_at)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                User ID: {freelancerAcceptance.accepted_by_user_id.slice(0, 8)}...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Terms: {freelancerAcceptance.terms_version} | Contract: {freelancerAcceptance.contract_version}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">Pendente</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Snapshot Hash for Audit */}
                    {(companyAcceptance || freelancerAcceptance) && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
                        <div className="flex items-center gap-2 mb-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Hash de Auditoria (Snapshot)
                          </span>
                        </div>
                        {companyAcceptance && (
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground">Contratante:</p>
                            <code className="text-xs font-mono break-all">{companyAcceptance.contract_snapshot_hash}</code>
                          </div>
                        )}
                        {freelancerAcceptance && (
                          <div>
                            <p className="text-xs text-muted-foreground">Prestador:</p>
                            <code className="text-xs font-mono break-all">{freelancerAcceptance.contract_snapshot_hash}</code>
                          </div>
                        )}
                      </div>
                    )}
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
                      <p className="text-xs text-muted-foreground mt-2">
                        ID: {contract.company_user_id.slice(0, 8)}...
                      </p>
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
                      <p className="text-xs text-muted-foreground mt-2">
                        ID: {contract.freelancer_user_id.slice(0, 8)}...
                      </p>
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
                    <div className="p-3 rounded-md bg-muted/50 border-l-4 border-primary">
                      <p className="text-foreground leading-relaxed">
                        Este contrato tem por objeto a prestação de serviços pelo <strong>PRESTADOR</strong> ao{" "}
                        <strong>CONTRATANTE</strong>, conforme descrito no projeto e no escopo abaixo.{" "}
                        <span className="font-medium">
                          O escopo é vinculante e será usado para avaliação de entregas e eventuais disputas.
                        </span>
                      </p>
                    </div>
                    
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
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                                  {milestone.description}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="flex-shrink-0">
                              {formatMoneyFromCents(milestone.amount * 100, contract.currency)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic p-4 border rounded-lg">
                        Nenhum milestone definido.
                      </p>
                    )}
                    
                    <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                      <p className="text-muted-foreground">
                        O <strong>CONTRATANTE</strong> deverá aprovar ou recusar cada entrega em até 7 dias úteis. 
                        O silêncio será considerado aprovação tácita.
                      </p>
                    </div>
                  </div>
                </section>

                {/* SECTION 4: VALOR E PAGAMENTO */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">4. Do Valor e Forma de Pagamento</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm space-y-3">
                    <p>
                      O valor total acordado é de{" "}
                      <strong>{formatMoneyFromCents(contract.amount_cents, contract.currency)}</strong>, 
                      dividido conforme milestones acima.
                    </p>
                    <p className="text-muted-foreground">
                      Os pagamentos são processados via plataforma, com proteção escrow. 
                      A liberação ocorre após aprovação de cada entrega.
                    </p>
                  </div>
                </section>

                {/* SECTIONS 5-12: LEGAL CLAUSES */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">5. Da Confidencialidade</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      As partes comprometem-se a manter sigilo sobre informações confidenciais 
                      trocadas durante a execução do contrato, exceto se autorizado por escrito.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">6. Da Propriedade Intelectual</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Os direitos de propriedade intelectual dos entregáveis serão transferidos 
                      ao CONTRATANTE após pagamento integral, salvo acordo específico em contrário.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">7. Dos Prazos</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Os prazos definidos nos milestones são vinculativos.{" "}
                      {contract.deadline 
                        ? `Prazo final: ${format(new Date(contract.deadline), "dd/MM/yyyy")}.`
                        : "Prazo a definir conforme acordado entre as partes."}
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">8. Do Cancelamento</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      O contrato pode ser cancelado por mútuo acordo ou em caso de inadimplemento. 
                      Valores em escrow serão tratados conforme política da plataforma.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">9. Das Disputas</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Em caso de disputas, as partes concordam em buscar resolução amigável via 
                      mediação da plataforma antes de qualquer procedimento judicial.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">10. Das Comunicações</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Todas as comunicações oficiais devem ser realizadas através da plataforma, 
                      garantindo registro e rastreabilidade.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Scale className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">11. Do Foro</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Para dirimir quaisquer controvérsias, as partes elegem o foro da comarca 
                      do domicílio do CONTRATANTE, com renúncia a qualquer outro.
                    </p>
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold">12. Disposições Finais</h4>
                  </div>
                  <div className="p-4 rounded-lg border bg-card text-sm text-muted-foreground">
                    <p>
                      Este contrato representa o acordo integral entre as partes. 
                      Alterações somente serão válidas mediante aditivo aceito por ambas as partes na plataforma.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* FIXED FOOTER */}
        <div className="flex-shrink-0 border-t bg-background px-4 py-3 sm:px-6">
          <div className="flex justify-end gap-3">
            {contract && (
              <Button variant="outline" size="sm" onClick={copyContractId}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar ID
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
