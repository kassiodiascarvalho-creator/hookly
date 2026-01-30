/**
 * Format CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Format CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/**
 * Format document based on type
 */
export function formatDocument(value: string, type: "cpf" | "cnpj" | null): string {
  if (!value) return "";
  if (type === "cpf") return formatCPF(value);
  if (type === "cnpj") return formatCNPJ(value);
  return value.replace(/\D/g, "");
}

/**
 * Remove formatting from document
 */
export function unformatDocument(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Validate CPF (basic validation - 11 digits)
 */
export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11;
}

/**
 * Validate CNPJ (basic validation - 14 digits)
 */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14;
}

/**
 * Validate document based on type
 */
export function isValidDocument(value: string, type: "cpf" | "cnpj" | null): boolean {
  if (!type) return true;
  if (type === "cpf") return isValidCPF(value);
  if (type === "cnpj") return isValidCNPJ(value);
  return false;
}
