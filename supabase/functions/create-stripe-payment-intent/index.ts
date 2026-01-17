import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Invalid authentication");
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;
    logStep("User authenticated", { userId });

    const body = await req.json();
    const { 
      amountCents, 
      currency, 
      contractId, 
      milestoneIndex, 
      description, 
      paymentType,
      // Contract funding fee info
      contractAmountCents,
      feePercent,
      feeAmountCents,
    } = body;

    if (!amountCents || amountCents <= 0) {
      throw new Error("Invalid amount");
    }
    if (!currency) {
      throw new Error("Currency is required");
    }

    // Validate contract funding has contract amount
    if (paymentType === 'contract_funding') {
      if (!contractAmountCents || contractAmountCents <= 0) {
        throw new Error("Contract amount is required for contract funding");
      }
    }

    logStep("Payment request", { 
      amountCents, 
      contractAmountCents,
      feePercent,
      feeAmountCents,
      currency, 
      contractId, 
      milestoneIndex, 
      paymentType 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists or create one
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });
    } else {
      const customer = await stripe.customers.create({ email: userEmail });
      customerId = customer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // Create payment record in unified_payments
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from("unified_payments")
      .insert({
        user_id: userId,
        user_type: "company",
        amount_cents: amountCents, // Total amount charged (including fee)
        currency: currency.toUpperCase(),
        payment_type: paymentType || "contract_funding",
        provider: "stripe",
        status: "pending",
        contract_id: contractId || null,
        metadata: {
          milestoneIndex,
          description,
          // Fee tracking for contract funding
          contract_amount_cents: contractAmountCents || null,
          fee_percent: feePercent || null,
          fee_amount_cents: feeAmountCents || null,
        },
      })
      .select()
      .single();

    if (paymentError) {
      logStep("Error creating payment record", paymentError);
      throw new Error("Failed to create payment record");
    }

    logStep("Created payment record", { paymentId: paymentRecord.id });

    // Create PaymentIntent with explicit payment method types
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        type: "contract_funding",
        paymentId: paymentRecord.id,
        contractId: contractId || "",
        milestoneIndex: String(milestoneIndex ?? ""),
        userId,
      },
    });

    logStep("PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret ? "present" : "missing"
    });

    // Update payment record with Stripe PaymentIntent ID
    await supabaseAdmin
      .from("unified_payments")
      .update({ provider_payment_id: paymentIntent.id })
      .eq("id", paymentRecord.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: paymentRecord.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
