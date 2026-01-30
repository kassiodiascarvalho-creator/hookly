import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  verificationId: string;
}

// Simple quality checks (no biometrics, just basic image validation)
interface QualityResult {
  score: number; // 0 to 1
  issues: string[];
  passed: boolean;
}

interface FileInfo {
  path: string;
  type: string;
  size: number;
}

// Minimum requirements
const MIN_FILE_SIZE = 50 * 1024; // 50KB minimum
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function checkFileQuality(file: FileInfo): QualityResult {
  const issues: string[] = [];
  let score = 1.0;

  // Check file size
  if (file.size < MIN_FILE_SIZE) {
    issues.push("file_too_small");
    score -= 0.3;
  }
  if (file.size > MAX_FILE_SIZE) {
    issues.push("file_too_large");
    score -= 0.2;
  }

  // For a real implementation, you would:
  // 1. Download the file from storage
  // 2. Use image processing library to check:
  //    - Resolution (minimum 1000x600 for documents)
  //    - Blur detection (Laplacian variance)
  //    - Brightness/contrast
  //    - Face detection for selfie
  // 
  // For now, we'll pass most checks and let admin review

  return {
    score: Math.max(0, score),
    issues,
    passed: score >= 0.5,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { verificationId } = body;

    if (!verificationId) {
      return new Response(
        JSON.stringify({ error: "Missing verificationId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, call RPC to finalize uploads and validate files exist
    const { data: finalizeResult, error: finalizeError } = await supabaseAdmin
      .rpc("finalize_identity_uploads", {
        p_verification_id: verificationId,
      });

    if (finalizeError) {
      console.error("[IDENTITY] Finalize error:", finalizeError);
      return new Response(
        JSON.stringify({ error: finalizeError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!finalizeResult.success) {
      const errorMessages: Record<string, string> = {
        not_found: "Verificação não encontrada",
        invalid_status: "Status inválido para finalização",
        missing_files: "Arquivos obrigatórios não enviados",
      };

      return new Response(
        JSON.stringify({ 
          success: false,
          code: finalizeResult.error,
          message: errorMessages[finalizeResult.error] || finalizeResult.error,
          missing: finalizeResult.missing,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IDENTITY] Uploads finalized for ${verificationId}, starting quality check`);

    // Get uploaded files info
    const { data: files, error: filesError } = await supabaseAdmin
      .from("identity_verification_files")
      .select("*")
      .eq("identity_verification_id", verificationId);

    if (filesError || !files || files.length === 0) {
      console.error("[IDENTITY] Files fetch error:", filesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch files" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run quality checks on each file
    const qualityResults: Record<string, QualityResult> = {};
    let overallScore = 0;
    let hasIssues = false;

    for (const file of files) {
      const result = checkFileQuality({
        path: file.storage_path,
        type: file.file_type,
        size: file.size_bytes,
      });
      qualityResults[file.file_type] = result;
      overallScore += result.score;
      if (result.issues.length > 0) {
        hasIssues = true;
      }
    }

    overallScore = overallScore / files.length;

    // Determine result status
    // For internal provider without biometrics, we always go to manual_review
    // This is intentional for security - human review is required
    let resultStatus = "manual_review";
    let riskLevel = "low";
    let failureReason: string | null = null;

    if (overallScore < 0.5) {
      resultStatus = "failed_soft";
      riskLevel = "medium";
      failureReason = "Qualidade das imagens insuficiente. Por favor, envie fotos mais nítidas.";
    } else if (hasIssues) {
      riskLevel = "medium";
    }

    console.log(`[IDENTITY] Quality check complete: score=${overallScore}, status=${resultStatus}`);

    // Process the verification
    const { error: processError } = await supabaseAdmin
      .rpc("process_identity_verification", {
        p_verification_id: verificationId,
        p_status: resultStatus,
        p_risk_score: overallScore,
        p_risk_level: riskLevel,
        p_failure_reason: failureReason,
        p_quality_results: {
          overall_score: overallScore,
          files: qualityResults,
          checked_at: new Date().toISOString(),
        },
      });

    if (processError) {
      console.error("[IDENTITY] Process error:", processError);
      return new Response(
        JSON.stringify({ error: processError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: resultStatus,
        riskScore: overallScore,
        riskLevel,
        failureReason,
        message: resultStatus === "manual_review" 
          ? "Seus documentos foram enviados e estão em análise. Você receberá uma notificação quando a verificação for concluída."
          : "Houve um problema com as imagens. Por favor, tente novamente com fotos mais nítidas.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[IDENTITY] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
