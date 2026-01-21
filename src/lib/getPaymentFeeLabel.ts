import type { TFunction } from "i18next";

/**
 * Safe fee label hierarchy:
 * 1. Translation (i18n)
 * 2. DB display_name (if provided)
 * 3. Generic fallback (never expose fee_key)
 */
export function getPaymentFeeLabel(
  feeKey: string,
  t: TFunction,
  dbDisplayName?: string | null
): string {
  // Try translation first
  const translationKey = `payments.feeLabels.${feeKey}`;
  const translation = t(translationKey, { defaultValue: "" });
  
  if (translation && translation !== translationKey && translation !== "") {
    return translation;
  }
  
  // Fallback to DB display_name if provided
  if (dbDisplayName) {
    return dbDisplayName;
  }
  
  // Ultimate fallback - never show technical keys
  return t("payments.feeLabels.processingFee", "Taxa de Processamento");
}

/**
 * Format monetary values safely
 * Returns "—" for zero/null/undefined values
 */
export function formatSafeMonetary(
  value: number | null | undefined,
  formatter: (v: number) => string,
  placeholder: string = "—"
): string {
  if (value === null || value === undefined || value === 0) {
    return placeholder;
  }
  return formatter(value);
}

/**
 * Terminology map for strategic word replacement
 * Maps technical terms to user-friendly alternatives
 */
export const STRATEGIC_TERMINOLOGY = {
  // Trigger words → Strategic replacements
  taxa: "proteção",
  fee: "protection",
  saque: "transferência",
  withdrawal: "transfer",
  saldo: "créditos disponíveis",
  balance: "available credits",
} as const;
