import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Briefcase, DollarSign } from "lucide-react";
import { formatMoney, getCurrencySymbol } from "@/lib/formatMoney";
import { ProjectPrefundModal } from "@/components/projects/ProjectPrefundModal";

interface ProjectUnfunded {
  id: string;
  title: string;
  budgetMax: number;
  currency: string;
}

interface UnfundedPotentialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectUnfunded[];
  onPaymentComplete: () => void;
}

export function UnfundedPotentialModal({
  open,
  onOpenChange,
  projects,
  onPaymentComplete,
}: UnfundedPotentialModalProps) {
  const { t } = useTranslation();
  const [selectedProject, setSelectedProject] = useState<ProjectUnfunded | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [prefundModalOpen, setPrefundModalOpen] = useState(false);

  // Group projects by currency
  const projectsByCurrency = projects.reduce((acc, project) => {
    if (!acc[project.currency]) {
      acc[project.currency] = [];
    }
    acc[project.currency].push(project);
    return acc;
  }, {} as Record<string, ProjectUnfunded[]>);

  const handleAmountChange = (projectId: string, value: string) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [projectId]: value,
    }));
  };

  const getAmount = (project: ProjectUnfunded) => {
    const customValue = customAmounts[project.id];
    if (customValue !== undefined && customValue !== "") {
      return parseFloat(customValue) || 0;
    }
    return project.budgetMax;
  };

  const handleFundProject = (project: ProjectUnfunded) => {
    const amount = getAmount(project);
    if (amount <= 0) return;
    
    // Store the custom amount in the project temporarily
    const projectWithAmount = {
      ...project,
      budgetMax: amount,
    };
    
    setSelectedProject(projectWithAmount);
    onOpenChange(false);
    setPrefundModalOpen(true);
  };

  const handlePaymentComplete = () => {
    setPrefundModalOpen(false);
    setSelectedProject(null);
    setCustomAmounts({});
    onPaymentComplete();
  };

  const handlePrefundModalClose = (isOpen: boolean) => {
    setPrefundModalOpen(isOpen);
    if (!isOpen) {
      onOpenChange(true);
    }
  };

  const handleSkip = () => {
    setPrefundModalOpen(false);
    onOpenChange(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {t("companyFinances.unfundedPotential.modalTitle", "Projetos sem Proteção de Pagamento")}
            </DialogTitle>
            <DialogDescription>
              {t("companyFinances.unfundedPotential.modalDescription", "Adicione fundos para aumentar a confiança dos freelancers e receber mais propostas.")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {Object.entries(projectsByCurrency).map(([currency, currencyProjects]) => (
                <div key={currency}>
                  {/* Currency Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="font-medium">
                      {currency}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {currencyProjects.length} {t("common.projects", "projetos")}
                    </span>
                  </div>

                  {/* Projects List */}
                  <div className="space-y-4">
                    {currencyProjects.map((project) => (
                      <div
                        key={project.id}
                        className="p-4 rounded-lg border bg-card space-y-3"
                      >
                        {/* Project Header */}
                        <div>
                          <h4 className="font-medium text-sm line-clamp-1">{project.title}</h4>
                          <div className="text-xs text-muted-foreground mt-1">
                            {t("companyFinances.unfundedPotential.maxBudget", "Orçamento máximo")}: {formatMoney(project.budgetMax, currency)}
                          </div>
                        </div>

                        <Separator />

                        {/* Amount Input + Button */}
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">
                              {t("companyFinances.unfundedPotential.amountToAdd", "Valor a adicionar")}
                            </Label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                {getCurrencySymbol(currency)}
                              </span>
                              <Input
                                type="number"
                                value={customAmounts[project.id] ?? project.budgetMax}
                                onChange={(e) => handleAmountChange(project.id, e.target.value)}
                                className="pl-8 h-9"
                                min={0.01}
                                step={0.01}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleFundProject(project)}
                            disabled={getAmount(project) <= 0}
                            className="gap-1"
                          >
                            <DollarSign className="h-3 w-3" />
                            {t("companyFinances.addFunds", "Adicionar")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="mt-4" />
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t("companyFinances.unfundedPotential.noProjects", "Nenhum projeto sem proteção.")}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Project Prefund Modal */}
      {selectedProject && (
        <ProjectPrefundModal
          open={prefundModalOpen}
          onOpenChange={handlePrefundModalClose}
          projectId={selectedProject.id}
          budgetMax={selectedProject.budgetMax}
          currency={selectedProject.currency}
          onPrefundComplete={handlePaymentComplete}
          onSkip={handleSkip}
        />
      )}
    </>
  );
}
