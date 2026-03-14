import type { TFunction } from "i18next";

export function getPaymentFeeLabel(
  feeKey: string,
  t: TFunction,
  dbDisplayName?: string | null
): string {
  const translationKey = `payments.feeLabels.${feeKey}`;
  const translation = t(translationKey, { defaultValue: "" });
  if (translation && translation !== translationKey && translation !== "") return translation;
  if (dbDisplayName) return dbDisplayName;
  return t("payments.feeLabels.processingFee", "Taxa de Processamento");
}

export function formatSafeMonetary(
  value: number | null | undefined,
  formatter: (v: number) => string,
  placeholder: string = "—"
): string {
  if (value === null || value === undefined || value === 0) return placeholder;
  return formatter(value);
}

export const STRATEGIC_TERMINOLOGY = {
  taxa: "proteção",
  fee: "protection",
  saque: "transferência",
  withdrawal: "transfer",
  saldo: "créditos disponíveis",
  balance: "available credits",
} as const;