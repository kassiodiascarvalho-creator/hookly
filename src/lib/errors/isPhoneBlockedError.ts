import type { PostgrestError } from "@supabase/supabase-js";

export function isPhoneBlockedError(error: PostgrestError | null | undefined): boolean {
  if (!error) return false;

  // Mais confiável: message exata
  if (error.message === "PHONE_NOT_ALLOWED") return true;

  // Fallback: errcode do RAISE EXCEPTION
  if (error.code === "P0001") return true;

  // Fallback extra (caso provider mude formato)
  if ((error.details ?? "").includes("Sharing phone numbers")) return true;
  if ((error.message ?? "").toLowerCase().includes("phone")) return true;

  return false;
}
