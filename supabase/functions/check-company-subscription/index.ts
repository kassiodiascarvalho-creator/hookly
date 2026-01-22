import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-COMPANY-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Plan configuration
const PLAN_PRODUCTS: Record<string, string> = {
  "prod_TprcldXtcRuPXU": "starter",
  "prod_TprevorVOntXMc": "pro",
  "prod_TprekbdvXrb5nY": "elite",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      throw new Error("Invalid authentication");
    }
    
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    
    if (!userId || !userEmail) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId, email: userEmail });

    // Check if user is a company
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_type")
      .eq("user_id", userId)
      .single();

    if (profile?.user_type !== "company") {
      return new Response(
        JSON.stringify({ error: "Only companies can have subscription plans" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get existing plan from database
    const { data: existingPlan } = await supabaseAdmin
      .from("company_plans")
      .select("*")
      .eq("company_user_id", userId)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found, returning free plan");
      
      // Create or update plan record
      if (!existingPlan) {
        await supabaseAdmin.from("company_plans").insert({
          company_user_id: userId,
          plan_type: "free",
          status: "active",
        });
      }
      
      return new Response(
        JSON.stringify({
          subscribed: false,
          plan_type: "free",
          subscription_end: null,
          projects_used: existingPlan?.projects_this_month || 0,
          projects_limit: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let planType = "free";
    let subscriptionEnd: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      stripeSubscriptionId = subscription.id;
      
      const productId = subscription.items.data[0].price.product as string;
      planType = PLAN_PRODUCTS[productId] || "free";
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        planType,
        productId
      });
    } else {
      logStep("No active subscription found");
    }

    // Update or create plan record
    const planData = {
      company_user_id: userId,
      plan_type: planType,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: customerId,
      status: hasActiveSub ? "active" : "canceled",
      current_period_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    };

    if (existingPlan) {
      await supabaseAdmin
        .from("company_plans")
        .update(planData)
        .eq("id", existingPlan.id);
    } else {
      await supabaseAdmin.from("company_plans").insert(planData);
    }

    // Get updated plan with project counts
    const { data: updatedPlan } = await supabaseAdmin
      .from("company_plans")
      .select("*")
      .eq("company_user_id", userId)
      .single();

    const projectsLimit = planType === "starter" ? 5 : null;

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        plan_type: planType,
        subscription_end: subscriptionEnd,
        projects_used: updatedPlan?.projects_this_month || 0,
        projects_limit: projectsLimit,
        cancel_at_period_end: subscriptions.data[0]?.cancel_at_period_end || false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
