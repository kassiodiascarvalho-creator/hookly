import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  verificationId: string;
  decision: "approved" | "rejected";
  notes?: string;
}

interface ResetBody {
  verificationId: string;
  notes?: string;
}

interface GetFilesBody {
  verificationId: string;
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

    // Check admin permission
    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    
    if (adminError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body to determine action
    const body = await req.json();
    const action = body.action || "review";

    if (action === "get-files") {
      // Get files with signed URLs for admin review
      const { verificationId } = body as GetFilesBody;

      if (!verificationId) {
        return new Response(
          JSON.stringify({ error: "Missing verificationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get file records
      const { data: files, error: filesError } = await supabaseAdmin
        .rpc("get_identity_files_for_review", {
          p_verification_id: verificationId,
        });

      if (filesError) {
        console.error("[IDENTITY ADMIN] Files error:", filesError);
        return new Response(
          JSON.stringify({ error: filesError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate signed URLs for each file (10 minute expiry)
      const filesWithUrls = await Promise.all(
        (files || []).map(async (file: any) => {
          const { data: signedUrl } = await supabaseAdmin.storage
            .from("identity_private")
            .createSignedUrl(file.storage_path, 600); // 10 minutes

          return {
            ...file,
            signedUrl: signedUrl?.signedUrl || null,
          };
        })
      );

      return new Response(
        JSON.stringify({ success: true, files: filesWithUrls }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset") {
      // Reset verification to allow new attempt
      const { verificationId, notes } = body as ResetBody;

      if (!verificationId) {
        return new Response(
          JSON.stringify({ error: "Missing verificationId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[IDENTITY ADMIN] Resetting verification ${verificationId}`);

      const { data: result, error: resetError } = await supabaseAdmin
        .rpc("admin_reset_identity_verification", {
          p_verification_id: verificationId,
          p_notes: notes,
          p_admin_id: authUser.id,
        });

      if (resetError) {
        console.error("[IDENTITY ADMIN] Reset error:", resetError);
        return new Response(
          JSON.stringify({ error: resetError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Verificação liberada para nova tentativa" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: review (approve/reject)
    const { verificationId, decision, notes } = body as RequestBody;

    if (!verificationId || !decision) {
      return new Response(
        JSON.stringify({ error: "Missing verificationId or decision" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["approved", "rejected"].includes(decision)) {
      return new Response(
        JSON.stringify({ error: "Invalid decision. Must be 'approved' or 'rejected'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[IDENTITY ADMIN] ${decision} verification ${verificationId}`);

    const { data: result, error: reviewError } = await supabaseAdmin
      .rpc("admin_review_identity", {
        p_verification_id: verificationId,
        p_decision: decision,
        p_notes: notes,
        p_admin_id: authUser.id,
      });

    if (reviewError) {
      console.error("[IDENTITY ADMIN] Review error:", reviewError);
      return new Response(
        JSON.stringify({ error: reviewError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: decision === "approved" 
          ? "Verificação aprovada com sucesso" 
          : "Verificação rejeitada" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[IDENTITY ADMIN] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
