import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "list" | "get" | "update";

function maskKey(key: string) {
  return `${key.slice(0, 12)}...`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Validate user + admin
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: isAdmin, error: isAdminError } = await supabaseUser.rpc("is_admin");
    if (isAdminError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const body = (await req.json().catch(() => null)) as any;
    const action: Action = body?.action;

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (action === "list") {
      const { data, error } = await supabaseAdmin
        .from("payment_providers")
        .select("id, provider, is_enabled, is_sandbox, webhook_url, last_tested_at, test_status, config_encrypted, updated_at")
        .order("provider");

      if (error) throw error;

      return new Response(JSON.stringify({ providers: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const provider: string | undefined = body?.provider;
    if (!provider) {
      return new Response(JSON.stringify({ error: "Missing provider" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (action === "get") {
      const { data, error } = await supabaseAdmin
        .from("payment_providers")
        .select("id, provider, is_enabled, is_sandbox, webhook_url, last_tested_at, test_status, config_encrypted, updated_at")
        .eq("provider", provider)
        .maybeSingle();

      if (error) throw error;

      const publicKey = (data?.config_encrypted as any)?.public_key as string | undefined;
      console.log("[ADMIN-PAYMENT-PROVIDERS] get", {
        provider,
        public_key_masked: publicKey ? maskKey(publicKey) : null,
        public_key_length: publicKey ? publicKey.length : 0,
      });

      return new Response(JSON.stringify({ provider: data ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update") {
      const updates = body?.updates ?? {};

      const { data: current, error: currentError } = await supabaseAdmin
        .from("payment_providers")
        .select("id, config_encrypted")
        .eq("provider", provider)
        .maybeSingle();

      if (currentError) throw currentError;
      if (!current?.id) {
        return new Response(JSON.stringify({ error: "Provider not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      const nextConfig = { ...(current.config_encrypted as Record<string, unknown> | null) };
      if (typeof updates.public_key === "string") {
        nextConfig.public_key = updates.public_key;
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (typeof updates.is_enabled === "boolean") updatePayload.is_enabled = updates.is_enabled;
      if (typeof updates.is_sandbox === "boolean") updatePayload.is_sandbox = updates.is_sandbox;
      if ("public_key" in updates) updatePayload.config_encrypted = nextConfig;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("payment_providers")
        .update(updatePayload)
        .eq("id", current.id)
        .select("id, provider, is_enabled, is_sandbox, webhook_url, last_tested_at, test_status, config_encrypted, updated_at")
        .single();

      if (updateError) throw updateError;

      const publicKey = (updated?.config_encrypted as any)?.public_key as string | undefined;
      console.log("[ADMIN-PAYMENT-PROVIDERS] update", {
        provider,
        public_key_masked: publicKey ? maskKey(publicKey) : null,
        public_key_length: publicKey ? publicKey.length : 0,
      });

      return new Response(JSON.stringify({ provider: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ADMIN-PAYMENT-PROVIDERS] ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
