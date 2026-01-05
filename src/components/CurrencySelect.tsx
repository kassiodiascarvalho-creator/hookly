import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { COMMON_CURRENCIES, ALL_CURRENCIES, getCurrencySymbol } from "@/lib/formatMoney";

interface CurrencySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function CurrencySelect({ value, onValueChange, className }: CurrencySelectProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  
  const currencies = showAll ? ALL_CURRENCIES : COMMON_CURRENCIES;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={t("currency.select")} />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {getCurrencySymbol(currency)} {currency}
          </SelectItem>
        ))}
        {!showAll && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAll(true);
              }}
            >
              {t("currency.showAll")}
            </Button>
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
