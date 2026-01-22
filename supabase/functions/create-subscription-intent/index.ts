import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-SUBSCRIPTION-INTENT] ${step}${detailsStr}`);
};

// Price IDs for each plan
const PLAN_PRICES: Record<string, string> = {
  starter: "price_1SsBtG3Vsa0jBPRLlsc0LJ25",
  pro: "price_1SsBuv3Vsa0jBPRLS8MUiy2e",
  elite: "price_1SsBvI3Vsa0jBPRLfZzm5n8F",
};

const PLAN_DISPLAY: Record<string, { name: string; price: number }> = {
  starter: { name: "Business Starter", price: 14900 },
  pro: { name: "Business Pro", price: 29900 },
  elite: { name: "Business Elite", price: 49900 },
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const body = await req.json();
    const { planType } = body;

    if (!planType || !PLAN_PRICES[planType]) {
      throw new Error(`Invalid plan type: ${planType}. Valid options: starter, pro, elite`);
    }

    const priceId = PLAN_PRICES[planType];
    const planInfo = PLAN_DISPLAY[planType];
    logStep("Selected plan", { planType, priceId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get or create Stripe customer
    let customerId: string;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
      
      // Check for existing active subscription
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      
      if (existingSubs.data.length > 0) {
        throw new Error("Você já possui uma assinatura ativa. Gerencie pelo portal do cliente.");
      }
    } else {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // Create subscription with incomplete status to get PaymentIntent
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: ["card"],
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId,
        planType,
      },
    });

    logStep("Created incomplete subscription", { subscriptionId: subscription.id });

    // Get the client secret from the payment intent
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    if (!paymentIntent?.client_secret) {
      throw new Error("Failed to get payment intent client secret");
    }

    logStep("Got client secret for payment", { 
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent.id 
    });

    // Store pending subscription in database
    await supabaseAdmin.from("company_plans").upsert({
      company_user_id: userId,
      plan_type: "free", // Will be updated by webhook when payment succeeds
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: "incomplete",
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_user_id" });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
        planName: planInfo.name,
        amount: planInfo.price,
        currency: "BRL",
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
