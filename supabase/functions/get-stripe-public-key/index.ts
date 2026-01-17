import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the Stripe publishable key from environment
    const publishableKey = Deno.env.get("VITE_STRIPE_PUBLISHABLE_KEY");
    
    if (!publishableKey) {
      console.error("[get-stripe-public-key] VITE_STRIPE_PUBLISHABLE_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Stripe não configurado: faltando VITE_STRIPE_PUBLISHABLE_KEY",
          configured: false 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Return 200 so frontend can handle gracefully
        }
      );
    }

    // Validate it's a publishable key (starts with pk_)
    if (!publishableKey.startsWith("pk_")) {
      console.error("[get-stripe-public-key] Invalid publishable key format");
      return new Response(
        JSON.stringify({ 
          error: "Chave Stripe inválida (deve começar com pk_)",
          configured: false 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("[get-stripe-public-key] Returning publishable key");
    
    return new Response(
      JSON.stringify({ 
        publishableKey,
        configured: true 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[get-stripe-public-key] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, configured: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
