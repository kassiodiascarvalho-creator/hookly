import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function maskKey(key: string) {
  return `${key.slice(0, 12)}...`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const envKey = Deno.env.get("VITE_MERCADOPAGO_PUBLIC_KEY") ?? "";

    const { data, error } = await supabaseAdmin
      .from("payment_providers")
      .select("is_enabled, config_encrypted")
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (error) {
      console.error("[GET-MP-PUBLIC-KEY] DB error", { message: error.message });
    }

    const dbKey = (data?.config_encrypted as any)?.public_key as string | undefined;
    const isEnabled = !!data?.is_enabled;

    let source: "env" | "db" | "missing" = "missing";
    let publicKey = "";

    if (envKey) {
      source = "env";
      publicKey = envKey;
    } else if (dbKey) {
      source = "db";
      publicKey = dbKey;
    }

    console.log("[GET-MP-PUBLIC-KEY] resolved", {
      source,
      isEnabled,
      masked: publicKey ? maskKey(publicKey) : null,
      length: publicKey ? publicKey.length : 0,
    });

    return new Response(
      JSON.stringify({
        publicKey,
        source,
        isEnabled,
        length: publicKey ? publicKey.length : 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[GET-MP-PUBLIC-KEY] ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
