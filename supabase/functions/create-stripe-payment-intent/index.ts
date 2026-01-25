import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-PAYMENT-INTENT] ${step}${detailsStr}`);
};

// Valid payment types
const VALID_PAYMENT_TYPES = [
  "contract_funding",
  "freelancer_credits",
  "platform_credits",
  "company_credits",
  "project_prefund",
];

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header using getClaims for reliability
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      logStep("Auth failed", { error: claimsError?.message });
      throw new Error("Invalid authentication");
    }
    
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    
    if (!userId || !userEmail) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId });

    const body = await req.json();
    const { 
      amountCents, 
      currency, 
      contractId,
      projectId,
      milestoneIndex, 
      description, 
      paymentType,
      userType,
      creditsAmount,
      // Contract funding fee info
      contractAmountCents,
      feePercent,
      feeAmountCents,
    } = body;

    logStep("Request body received", { 
      amountCents, 
      currency, 
      paymentType,
      projectId,
      contractId,
    });

    if (!amountCents || amountCents <= 0) {
      logStep("Invalid amount", { amountCents });
      throw new Error("Invalid amount");
    }
    if (!currency) {
      logStep("Missing currency");
      throw new Error("Currency is required");
    }

    // Validate payment type
    const validatedPaymentType = paymentType || "contract_funding";
    if (!VALID_PAYMENT_TYPES.includes(validatedPaymentType)) {
      logStep("Invalid payment type", { paymentType: validatedPaymentType });
      throw new Error(`Invalid payment type: ${validatedPaymentType}`);
    }

    // Validate contract funding has contract amount
    if (validatedPaymentType === 'contract_funding') {
      if (!contractAmountCents || contractAmountCents <= 0) {
        throw new Error("Contract amount is required for contract funding");
      }
    }
    
    // Validate projectId if project_prefund
    if (validatedPaymentType === 'project_prefund') {
      if (!projectId || typeof projectId !== 'string') {
        logStep("Missing projectId for project_prefund");
        throw new Error("Project ID is required for project prefund");
      }
    }

    // Determine user type based on payment type if not provided
    const resolvedUserType = userType || (
      validatedPaymentType === 'freelancer_credits' ? 'freelancer' : 'company'
    );

    logStep("Payment request", { 
      amountCents, 
      contractAmountCents,
      feePercent,
      feeAmountCents,
      currency, 
      contractId, 
      milestoneIndex, 
      paymentType: validatedPaymentType,
      userType: resolvedUserType,
      creditsAmount,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

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
        user_type: resolvedUserType,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        payment_type: validatedPaymentType,
        provider: "stripe",
        status: "pending",
        contract_id: contractId || null,
        credits_amount: creditsAmount || null,
        metadata: {
          milestoneIndex,
          description,
          // Fee tracking for contract funding
          contract_amount_cents: contractAmountCents || null,
          fee_percent: feePercent || null,
          fee_amount_cents: feeAmountCents || null,
          credits_amount: creditsAmount || null,
          // Project prefund tracking
          project_id: projectId || null,
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
        type: validatedPaymentType,
        paymentId: paymentRecord.id,
        contractId: contractId || "",
        milestoneIndex: String(milestoneIndex ?? ""),
        userId,
        userType: resolvedUserType,
        creditsAmount: String(creditsAmount ?? ""),
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
