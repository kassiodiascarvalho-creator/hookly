import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { IdentityStatus } from "@/components/identity/IdentityVerificationBadge";

interface VerificationState {
  status: IdentityStatus;
  verificationId: string | null;
  attempts: number;
  maxAttempts: number;
  canStartVerification: boolean;
  verifiedAt: string | null;
  failureReason: string | null;
  riskScore: number | null;
  riskLevel: string | null;
  adminDecision: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseIdentityVerificationProps {
  subjectType: "freelancer" | "company";
}

interface RpcResult {
  status: string;
  verification_id?: string;
  attempts: number;
  max_attempts: number;
  can_start_verification: boolean;
  verified_at?: string;
  failure_reason?: string;
  risk_score?: number;
  risk_level?: string;
  admin_decision?: string;
}

// Type-safe RPC caller
async function callIdentityRpc<T>(
  rpcName: string,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const { data, error } = await supabase.rpc(rpcName as any, params);
  return { data: data as T | null, error: error ? new Error(error.message) : null };
}

export function useIdentityVerification({ subjectType }: UseIdentityVerificationProps) {
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>({
    status: "not_started",
    verificationId: null,
    attempts: 0,
    maxAttempts: 5,
    canStartVerification: true,
    verifiedAt: null,
    failureReason: null,
    riskScore: null,
    riskLevel: null,
    adminDecision: null,
    isLoading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const { data, error } = await callIdentityRpc<RpcResult>("get_identity_status", {
        p_user_id: user.id,
        p_subject_type: subjectType,
      });

      if (error) throw error;

      const result = data as RpcResult;

      // IMPORTANT UX RULE:
      // Backend currently uses 'pending' right after session creation.
      // For the UI, user only considers it "pending / under analysis" after clicking "Enviar para análise".
      // So we normalize: pending => uploading (treated as not_started in UI components).
      const rawStatus = (result.status || "not_started") as IdentityStatus;
      const normalizedStatus: IdentityStatus = rawStatus === "pending" ? "uploading" : rawStatus;
      const normalizedCanStart = rawStatus === "pending" ? true : (result.can_start_verification ?? true);

      setState({
        status: normalizedStatus,
        verificationId: result.verification_id || null,
        attempts: result.attempts || 0,
        maxAttempts: result.max_attempts || 5,
        canStartVerification: normalizedCanStart,
        verifiedAt: result.verified_at || null,
        failureReason: result.failure_reason || null,
        riskScore: result.risk_score ?? null,
        riskLevel: result.risk_level || null,
        adminDecision: result.admin_decision || null,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      console.error("[useIdentityVerification] Error:", err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch status",
      }));
    }
  }, [user, subjectType]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`identity-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "identity_verifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStatus]);

  const startVerification = useCallback(
    async (params: {
      country: string;
      documentType: string;
      hasBackSide: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("create-identity-session", {
        body: {
          country: params.country,
          documentType: params.documentType,
          subjectType,
          hasBackSide: params.hasBackSide,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (!data.success) {
        const errorMessages: Record<string, string> = {
          rate_limit_exceeded: "Muitas tentativas. Aguarde alguns minutos.",
          already_verified: "Você já foi verificado.",
          blocked_manual_review: "Sua verificação está em análise manual.",
          rejected: "Sua verificação foi rejeitada.",
          max_attempts_reached: "Número máximo de tentativas atingido.",
        };
        throw new Error(errorMessages[data.code] || data.message || data.code);
      }

      await fetchStatus();

      return {
        verificationId: data.verificationId,
        uploadPrefix: data.uploadPrefix,
        requiredFiles: data.requiredFiles as string[],
      };
    },
    [user, subjectType, fetchStatus]
  );

  const uploadFile = useCallback(
    async (params: {
      verificationId: string;
      uploadPrefix: string;
      fileType: "document_front" | "document_back" | "selfie";
      file: File;
    }) => {
      const { verificationId, uploadPrefix, fileType, file } = params;

      // Validate file
      const maxSize = 10 * 1024 * 1024; // 10MB
      const minSize = 50 * 1024; // 50KB minimum
      if (file.size > maxSize) {
        throw new Error("Arquivo muito grande. Máximo 10MB.");
      }
      if (file.size < minSize) {
        throw new Error("Arquivo muito pequeno. Mínimo 50KB.");
      }

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
      }

      // Generate unique filename
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${uploadPrefix}${fileType}.${ext}`;
      
      // Upload to storage (upsert replaces existing)
      const { error: uploadError } = await supabase.storage
        .from("identity_private")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload falhou: ${uploadError.message}`);
      }

      // Register file in database and get old path for cleanup
      const { data: registerData, error: registerError } = await callIdentityRpc<{
        file_id: string;
        old_storage_path: string | null;
      }>("register_identity_file", {
        p_verification_id: verificationId,
        p_file_type: fileType,
        p_storage_path: filePath,
        p_mime_type: file.type,
        p_size_bytes: file.size,
      });

      if (registerError) {
        throw new Error(`Registro falhou: ${registerError.message}`);
      }

      // If there was an old file, delete it from storage
      if (registerData?.old_storage_path && registerData.old_storage_path !== filePath) {
        try {
          await supabase.storage
            .from("identity_private")
            .remove([registerData.old_storage_path]);
        } catch (e) {
          // Non-critical - log but don't fail
          console.warn("[Identity] Failed to delete old file:", e);
        }
      }

      return filePath;
    },
    []
  );

  const finalizeUploads = useCallback(
    async (verificationId: string) => {
      const response = await supabase.functions.invoke("finalize-identity-uploads", {
        body: { verificationId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      await fetchStatus();

      return {
        success: data.success,
        status: data.status,
        failureReason: data.failureReason,
        message: data.message,
      };
    },
    [fetchStatus]
  );

  return {
    ...state,
    refetch: fetchStatus,
    startVerification,
    uploadFile,
    finalizeUploads,
  };
}
