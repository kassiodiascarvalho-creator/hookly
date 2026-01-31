import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function isValidUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

type Body = {
  projectId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client bound to the caller token (for is_admin())
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
    if (adminError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const projectId = body?.projectId;

    if (!isValidUUID(projectId)) {
      return new Response(JSON.stringify({ error: "Missing or invalid projectId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1) Gather contract IDs
    const { data: contractRows, error: contractsError } = await supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("project_id", projectId);
    if (contractsError) throw contractsError;

    const contractIds = (contractRows ?? []).map((r: any) => r.id).filter(Boolean) as string[];

    // 2) Break restrictive FKs from financial/audit tables to contracts
    if (contractIds.length > 0) {
      const { error: ledgerError } = await supabaseAdmin
        .from("ledger_transactions")
        .update({ related_contract_id: null })
        .in("related_contract_id", contractIds);
      if (ledgerError) throw ledgerError;

      const { error: unifiedPaymentsError } = await supabaseAdmin
        .from("unified_payments")
        .update({ contract_id: null })
        .in("contract_id", contractIds);
      if (unifiedPaymentsError) throw unifiedPaymentsError;
    }

    // 3) Break restrictive FK from genius_usage_log -> projects
    const { error: geniusUsageError } = await supabaseAdmin
      .from("genius_usage_log")
      .update({ project_id: null })
      .eq("project_id", projectId);
    if (geniusUsageError) throw geniusUsageError;

    // 4) Remove cache rows
    const { error: cacheError } = await supabaseAdmin
      .from("genius_ranking_cache")
      .delete()
      .eq("project_id", projectId);
    if (cacheError) throw cacheError;

    // 5) Delete project (CASCADE handles contracts/proposals/reviews/invites/etc.)
    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from("projects")
      .delete()
      .eq("id", projectId)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;

    if (!deleted?.id) {
      return new Response(JSON.stringify({ success: false, error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[ADMIN-DELETE-PROJECT] Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
