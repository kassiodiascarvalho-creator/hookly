import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCurrencySymbol } from "@/lib/formatMoney";
import { getAllowedCurrencies } from "@/lib/currencyByCountry";

interface RestrictedCurrencySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  countryCode: string | null | undefined;
  className?: string;
}

/**
 * Currency select that only shows currencies allowed for the user's country
 * (local currency + USD)
 */
export function RestrictedCurrencySelect({ 
  value, 
  onValueChange, 
  countryCode,
  className 
}: RestrictedCurrencySelectProps) {
  const { t } = useTranslation();
  
  const allowedCurrencies = getAllowedCurrencies(countryCode);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={t("currency.select")} />
      </SelectTrigger>
      <SelectContent>
        {allowedCurrencies.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {getCurrencySymbol(currency)} {currency}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
