import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  country: string;
  documentType: string;
  subjectType: "freelancer" | "company";
  hasBackSide?: boolean;
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

    const userId = authUser.id;

    const body: RequestBody = await req.json();
    const { country, documentType, subjectType, hasBackSide = true } = body;

    // Validate inputs
    if (!country || !documentType || !subjectType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: country, documentType, subjectType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["freelancer", "company"].includes(subjectType)) {
      return new Response(
        JSON.stringify({ error: "Invalid subjectType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Valid document types
    const validDocTypes = ["cnh", "rg", "passport", "national_id", "drivers_license", "residence_permit"];
    if (!validDocTypes.includes(documentType)) {
      return new Response(
        JSON.stringify({ error: `Invalid documentType: ${documentType}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for RPC call
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[IDENTITY] Creating session for ${subjectType} ${userId}, country: ${country}, doc: ${documentType}`);

    // Call RPC to create verification
    const { data: result, error: rpcError } = await supabaseAdmin
      .rpc("create_identity_verification_with_uploads", {
        p_user_id: userId,
        p_subject_type: subjectType,
        p_country: country,
        p_document_type: documentType,
        p_has_back_side: hasBackSide,
      });

    if (rpcError) {
      console.error("[IDENTITY] RPC error:", rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        already_verified: "Você já foi verificado",
        blocked_manual_review: "Sua verificação está em análise manual",
        rejected: "Sua verificação foi rejeitada. Entre em contato com o suporte.",
        max_attempts_reached: "Número máximo de tentativas atingido",
      };

      return new Response(
        JSON.stringify({ 
          success: false,
          code: result.error,
          message: errorMessages[result.error] || result.error,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IDENTITY] Session created: ${result.verification_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        verificationId: result.verification_id,
        uploadPrefix: result.upload_prefix,
        requiredFiles: result.required_files,
        attempts: result.attempts,
        maxAttempts: result.max_attempts,
        status: result.status || "pending",
        message: result.message,
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
