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
  isLoading: boolean;
  error: string | null;
}

interface UseIdentityVerificationProps {
  subjectType: "freelancer" | "company";
}

export function useIdentityVerification({ subjectType }: UseIdentityVerificationProps) {
  const { user } = useAuth();
  const [state, setState] = useState<VerificationState>({
    status: "not_started",
    verificationId: null,
    attempts: 0,
    maxAttempts: 2,
    canStartVerification: true,
    verifiedAt: null,
    failureReason: null,
    isLoading: true,
    error: null,
  });

  const fetchStatus = useCallback(async () => {
    if (!user) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Use type assertion since this RPC is created by migration
      const { data, error } = await (supabase.rpc as any)("get_identity_status", {
        p_user_id: user.id,
        p_subject_type: subjectType,
      });

      if (error) throw error;

      const result = data as {
        status: string;
        verification_id?: string;
        attempts: number;
        max_attempts: number;
        can_start_verification: boolean;
        verified_at?: string;
        failure_reason?: string;
      };

      setState({
        status: (result.status || "not_started") as IdentityStatus,
        verificationId: result.verification_id || null,
        attempts: result.attempts || 0,
        maxAttempts: result.max_attempts || 2,
        canStartVerification: result.can_start_verification ?? true,
        verifiedAt: result.verified_at || null,
        failureReason: result.failure_reason || null,
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
        throw new Error(data.message || data.code);
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
      if (file.size > maxSize) {
        throw new Error("Arquivo muito grande. Máximo 10MB.");
      }

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
      }

      // Upload to storage
      const filePath = `${uploadPrefix}${fileType}.${file.name.split(".").pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from("identity_private")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload falhou: ${uploadError.message}`);
      }

      // Register file in database (use type assertion since this RPC is created by migration)
      const { error: registerError } = await (supabase.rpc as any)("register_identity_file", {
        p_verification_id: verificationId,
        p_file_type: fileType,
        p_storage_path: filePath,
        p_mime_type: file.type,
        p_size_bytes: file.size,
      });

      if (registerError) {
        throw new Error(`Registro falhou: ${registerError.message}`);
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

      if (!data.success) {
        throw new Error(data.message || data.code);
      }

      await fetchStatus();

      return data;
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
