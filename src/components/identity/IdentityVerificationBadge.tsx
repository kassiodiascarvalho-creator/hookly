export type IdentityStatus = "not_started" | "pending" | "uploading" | "processing" | "manual_review" | "verified" | "failed_soft" | "rejected";

export function IdentityVerificationBadge({ status }: { status: IdentityStatus }) {
  return null; // Stub - will be implemented when identity components are synced
}
