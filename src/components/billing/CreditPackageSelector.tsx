import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCreditPackages, CreditPackage } from "@/hooks/useCreditPackages";
import { formatMoneyFromCents } from "@/lib/formatMoney";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditPackageCardProps {
  pkg: CreditPackage;
  isSelected: boolean;
  onSelect: (pkg: CreditPackage) => void;
}

function CreditPackageCard({ pkg, isSelected, onSelect }: CreditPackageCardProps) {
  const { t } = useTranslation();
  const totalCredits = pkg.credits_amount + pkg.bonus_credits;
  const hasBonus = pkg.bonus_credits > 0;
  
  return (
    <Card 
      className={cn(
        "relative cursor-pointer transition-all hover:shadow-md",
        isSelected 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-border hover:border-primary/50"
      )}
      onClick={() => onSelect(pkg)}
    >
      {pkg.badge_text && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground shadow-sm">
            {pkg.badge_text}
          </Badge>
        </div>
      )}
      
      <CardContent className="pt-6 pb-4">
        <div className="text-center space-y-3">
          {/* Package Name */}
          <h3 className="font-semibold text-lg">{pkg.name}</h3>
          
          {/* Credits Display */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-3xl font-bold">{totalCredits}</span>
              <span className="text-muted-foreground">{t("billing.credits", "créditos")}</span>
            </div>
            
            {hasBonus && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                +{pkg.bonus_credits} {t("billing.bonusCredits", "bônus")} 🎁
              </p>
            )}
          </div>
          
          {/* Price */}
          <div className="pt-2">
            <span className="text-2xl font-bold">
              {formatMoneyFromCents(pkg.price_cents, pkg.currency)}
            </span>
          </div>
          
          {/* Per Credit Price */}
          <p className="text-xs text-muted-foreground">
            {formatMoneyFromCents(Math.round(pkg.price_cents / totalCredits), pkg.currency)}/{t("billing.perCredit", "crédito")}
          </p>
          
          {/* Selection Indicator */}
          {isSelected && (
            <div className="flex items-center justify-center gap-1 text-primary text-sm font-medium">
              <Check className="h-4 w-4" />
              {t("common.selected", "Selecionado")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface CreditPackageSelectorProps {
  selectedPackage: CreditPackage | null;
  onSelectPackage: (pkg: CreditPackage) => void;
  className?: string;
}

export function CreditPackageSelector({ 
  selectedPackage, 
  onSelectPackage,
  className 
}: CreditPackageSelectorProps) {
  const { t } = useTranslation();
  const { packages, loading, error } = useCreditPackages();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {t("common.error", "Erro ao carregar pacotes")}
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t("billing.noPackages", "Nenhum pacote disponível")}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {packages.map((pkg) => (
        <CreditPackageCard
          key={pkg.id}
          pkg={pkg}
          isSelected={selectedPackage?.id === pkg.id}
          onSelect={onSelectPackage}
        />
      ))}
    </div>
  );
}

export { CreditPackageCard };
