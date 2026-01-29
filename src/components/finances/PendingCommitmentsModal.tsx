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
import { Shield, DollarSign, User } from "lucide-react";
import { formatMoney, getCurrencySymbol } from "@/lib/formatMoney";
import { ContractFundingModal } from "@/components/payments/ContractFundingModal";

interface ContractPending {
  id: string;
  title: string;
  contractTotal: number;
  protectedCurrent: number;
  missing: number;
  currency: string;
  freelancerName: string | null;
  freelancerUserId: string;
}

interface PendingCommitmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: ContractPending[];
  onPaymentComplete: () => void;
}

export function PendingCommitmentsModal({
  open,
  onOpenChange,
  contracts,
  onPaymentComplete,
}: PendingCommitmentsModalProps) {
  const { t } = useTranslation();
  const [selectedContract, setSelectedContract] = useState<ContractPending | null>(null);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [fundingModalOpen, setFundingModalOpen] = useState(false);
  const [fundingAmount, setFundingAmount] = useState(0);

  // Group contracts by currency
  const contractsByCurrency = contracts.reduce((acc, contract) => {
    if (!acc[contract.currency]) {
      acc[contract.currency] = [];
    }
    acc[contract.currency].push(contract);
    return acc;
  }, {} as Record<string, ContractPending[]>);

  const handleAmountChange = (contractId: string, value: string) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [contractId]: value,
    }));
  };

  const getAmount = (contract: ContractPending) => {
    const customValue = customAmounts[contract.id];
    if (customValue !== undefined && customValue !== "") {
      return parseFloat(customValue) || 0;
    }
    return contract.missing;
  };

  const handleFundContract = (contract: ContractPending) => {
    const amount = getAmount(contract);
    if (amount <= 0) return;
    
    setSelectedContract(contract);
    setFundingAmount(amount);
    onOpenChange(false);
    setFundingModalOpen(true);
  };

  const handlePaymentComplete = () => {
    setFundingModalOpen(false);
    setSelectedContract(null);
    setCustomAmounts({});
    onPaymentComplete();
  };

  const handleFundingModalClose = (isOpen: boolean) => {
    setFundingModalOpen(isOpen);
    if (!isOpen) {
      onOpenChange(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t("companyFinances.pendingCommitments.modalTitle", "Contratos Pendentes de Proteção")}
            </DialogTitle>
            <DialogDescription>
              {t("companyFinances.pendingCommitments.modalDescription", "Adicione fundos para garantir o pagamento dos seus contratos.")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {Object.entries(contractsByCurrency).map(([currency, currencyContracts]) => (
                <div key={currency}>
                  {/* Currency Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="font-medium">
                      {currency}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {currencyContracts.length} {t("common.contracts", "contratos")}
                    </span>
                  </div>

                  {/* Contracts List */}
                  <div className="space-y-4">
                    {currencyContracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="p-4 rounded-lg border bg-card space-y-3"
                      >
                        {/* Contract Header */}
                        <div>
                          <h4 className="font-medium text-sm line-clamp-1">{contract.title}</h4>
                          {contract.freelancerName && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <User className="h-3 w-3" />
                              {contract.freelancerName}
                            </div>
                          )}
                        </div>

                        {/* Values */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground block">
                              {t("companyFinances.pendingCommitments.agreed", "Acordado")}
                            </span>
                            <span className="font-medium">
                              {formatMoney(contract.contractTotal, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">
                              {t("companyFinances.pendingCommitments.protected", "Protegido")}
                            </span>
                            <span className="font-medium text-green-600">
                              {formatMoney(contract.protectedCurrent, currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">
                              {t("companyFinances.pendingCommitments.missing", "Falta")}
                            </span>
                            <span className="font-medium text-amber-600">
                              {formatMoney(contract.missing, currency)}
                            </span>
                          </div>
                        </div>

                        <Separator />

                        {/* Amount Input + Button */}
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">
                              {t("companyFinances.pendingCommitments.amountToAdd", "Valor a adicionar")}
                            </Label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                {getCurrencySymbol(currency)}
                              </span>
                              <Input
                                type="number"
                                value={customAmounts[contract.id] ?? contract.missing}
                                onChange={(e) => handleAmountChange(contract.id, e.target.value)}
                                className="pl-8 h-9"
                                min={0.01}
                                step={0.01}
                              />
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleFundContract(contract)}
                            disabled={getAmount(contract) <= 0}
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

              {contracts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t("companyFinances.pendingCommitments.noContracts", "Nenhum contrato pendente de proteção.")}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Contract Funding Modal */}
      {selectedContract && (
        <ContractFundingModal
          open={fundingModalOpen}
          onOpenChange={handleFundingModalClose}
          contractId={selectedContract.id}
          amount={fundingAmount}
          currency={selectedContract.currency}
          description={selectedContract.title}
          freelancerUserId={selectedContract.freelancerUserId}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </>
  );
}
