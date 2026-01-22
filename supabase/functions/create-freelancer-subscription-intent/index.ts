import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-FREELANCER-SUBSCRIPTION-INTENT] ${step}${detailsStr}`);
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
    const { planType, paymentMethodId } = body as { planType?: string; paymentMethodId?: string };

    if (!planType) {
      throw new Error("Plan type is required");
    }

    // Fetch plan definition from freelancer_plan_definitions table
    const { data: planDef, error: planError } = await supabaseAdmin
      .from("freelancer_plan_definitions")
      .select("name, price_usd_cents, stripe_price_id")
      .eq("plan_type", planType)
      .eq("is_active", true)
      .single();

    if (planError || !planDef) {
      throw new Error(`Invalid plan type: ${planType}. Plan not found.`);
    }

    if (!planDef.stripe_price_id) {
      throw new Error(`Plan ${planType} does not have a Stripe price ID configured.`);
    }

    const priceId = planDef.stripe_price_id;
    const planName = planDef.name;
    const priceUsdCents = planDef.price_usd_cents;

    logStep("Selected plan from database", { planType, priceId, planName, priceUsdCents });

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
        metadata: { userId, userType: "freelancer" },
      });
      customerId = customer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // 1) First call: create a SetupIntent so the UI can collect the card transparently.
    // 2) Second call (with paymentMethodId): create the subscription and return the PaymentIntent client_secret.

    if (!paymentMethodId) {
      logStep("Creating setup intent", { customerId, planType });

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
        metadata: { userId, planType, userType: "freelancer" },
      });

      if (!setupIntent.client_secret) {
        throw new Error("Failed to create setup intent client secret");
      }

      return new Response(
        JSON.stringify({
          intentType: "setup",
          clientSecret: setupIntent.client_secret,
          planName,
          amount: priceUsdCents, // USD cents - frontend will convert to local currency
          currency: "USD",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create subscription with default payment method so an invoice PaymentIntent is generated.
    logStep("Creating subscription", { customerId, planType, hasPaymentMethodId: !!paymentMethodId });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      default_payment_method: paymentMethodId,
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
        userType: "freelancer",
      },
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | string | null;
    const invoiceId = typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id;
    if (!invoiceId) {
      throw new Error("Subscription created but latest_invoice is missing");
    }

    const invoice = (await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent"] })) as Stripe.Invoice;
    const invoicePaymentIntent = invoice.payment_intent as Stripe.PaymentIntent | string | null;

    if (!invoicePaymentIntent || typeof invoicePaymentIntent === "string" || !invoicePaymentIntent.client_secret) {
      logStep("Invoice has no payment intent", {
        subscriptionId: subscription.id,
        invoiceId,
        invoiceStatus: invoice.status,
        invoicePaymentIntent: invoice.payment_intent,
      });
      throw new Error("Failed to get payment intent client secret");
    }

    const clientSecret = invoicePaymentIntent.client_secret;

    // Store pending subscription in freelancer_plans table
    await supabaseAdmin.from("freelancer_plans").upsert({
      freelancer_user_id: userId,
      plan_type: "free", // Will be updated by webhook when payment succeeds
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: "incomplete",
      updated_at: new Date().toISOString(),
    }, { onConflict: "freelancer_user_id" });

    return new Response(
      JSON.stringify({
        intentType: "payment",
        clientSecret,
        subscriptionId: subscription.id,
        planName,
        amount: priceUsdCents, // USD cents - frontend will convert to local currency
        currency: "USD",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
