import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      featureType, // 'proposal_ai' or 'ranking_ai'
      accessDuration, // '2days' or '5days'
    } = await req.json();

    if (!featureType || !accessDuration) {
      return new Response(
        JSON.stringify({ error: "featureType and accessDuration are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["proposal_ai", "ranking_ai"].includes(featureType)) {
      return new Response(
        JSON.stringify({ error: "Invalid feature type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["2days", "5days"].includes(accessDuration)) {
      return new Response(
        JSON.stringify({ error: "Invalid access duration" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user type
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("user_id", user.id)
      .single();

    const userType = profile?.user_type || "freelancer";

    // Map duration to action key and days
    const durationConfig: Record<string, { actionKey: string; days: number }> = {
      "2days": { actionKey: "genius_2days", days: 2 },
      "5days": { actionKey: "genius_5days", days: 5 },
    };

    const config = durationConfig[accessDuration];

    // Get cost
    const { data: actionCost } = await supabase
      .from("platform_action_costs")
      .select("cost_credits, is_enabled")
      .eq("action_key", config.actionKey)
      .single();

    if (!actionCost || !actionCost.is_enabled) {
      return new Response(
        JSON.stringify({ error: "This access option is not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditsCost = actionCost.cost_credits;

    // Check user has enough credits
    const { data: credits } = await supabase
      .from("platform_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const currentBalance = credits?.balance || 0;

    if (currentBalance < creditsCost) {
      return new Response(
        JSON.stringify({ 
          error: "insufficient_credits",
          message: `Você precisa de ${creditsCost} créditos. Saldo atual: ${currentBalance}`,
          required: creditsCost,
          available: currentBalance,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Spend credits
    const { data: spendResult, error: spendError } = await supabase.rpc(
      "spend_platform_credits",
      {
        p_user_id: user.id,
        p_action_key: config.actionKey,
        p_description: `Hookly Genius - ${config.days} dias de acesso (${featureType})`,
      }
    );

    if (spendError || !spendResult) {
      console.error("Failed to spend credits:", spendError);
      return new Response(
        JSON.stringify({ error: "Failed to process payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.days);

    // Create access record
    const { data: access, error: accessError } = await supabase
      .from("genius_access")
      .insert({
        user_id: user.id,
        user_type: userType,
        feature_type: featureType,
        access_source: "credits",
        credits_spent: creditsCost,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (accessError) {
      console.error("Failed to create access:", accessError);
      return new Response(
        JSON.stringify({ error: "Failed to grant access" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        access: {
          featureType,
          expiresAt: expiresAt.toISOString(),
          durationDays: config.days,
          creditsSpent: creditsCost,
        },
        newBalance: currentBalance - creditsCost,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Genius purchase error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
