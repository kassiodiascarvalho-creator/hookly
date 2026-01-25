import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (correlationId: string, step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-STRIPE-PAYMENT-INTENT][${correlationId}] ${step}${detailsStr}`);
};

// Parse monetary input to cents (integer)
function parseMoneyToCents(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return NaN;
    return Math.round(input);
  }
  
  if (typeof input !== 'string') return NaN;
  
  let s = input.trim();
  if (!s) return NaN;
  
  // Remove currency symbols and spaces
  s = s.replace(/[^\d.,-]/g, "");
  
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep = "";
  
  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma !== -1) {
    decimalSep = ",";
  } else if (lastDot !== -1) {
    decimalSep = ".";
  }
  
  if (!decimalSep) {
    const onlyDigits = s.replace(/[^\d-]/g, "");
    const intVal = parseInt(onlyDigits || "0", 10);
    return intVal >= 100 ? intVal : intVal * 100;
  }
  
  const parts = s.split(decimalSep);
  const fracRaw = (parts.pop() ?? "").replace(/\D/g, "");
  const intRaw = parts.join(decimalSep).replace(/[.,]/g, "").replace(/\D/g, "") || "0";
  
  const intPart = parseInt(intRaw, 10);
  const fracPart = parseInt(fracRaw.padEnd(2, "0").slice(0, 2) || "0", 10);
  
  return intPart * 100 + fracPart;
}

// Valid payment types
const VALID_PAYMENT_TYPES = [
  "contract_funding",
  "freelancer_credits",
  "platform_credits",
  "company_credits",
  "project_prefund",
];

// Default fee percent
const DEFAULT_FEE_PERCENT = 0.15;

serve(async (req) => {
  const correlationId = crypto.randomUUID().slice(0, 8);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep(correlationId, "Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      logStep(correlationId, "Auth failed", { error: claimsError?.message });
      throw new Error("Invalid authentication");
    }
    
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    
    if (!userId || !userEmail) {
      throw new Error("User not authenticated or email not available");
    }
    logStep(correlationId, "User authenticated", { userId });

    const rawBody = await req.json();
    logStep(correlationId, "Raw input received", {
      amountCents: rawBody.amountCents,
      amountInput: rawBody.amountInput,
      currency: rawBody.currency,
      paymentType: rawBody.paymentType,
      projectId: rawBody.projectId,
      contractId: rawBody.contractId,
    });
    
    const { 
      amountCents: rawAmountCents,
      amountInput,
      currency, 
      contractId,
      projectId,
      milestoneIndex, 
      description, 
      paymentType,
      userType,
      creditsAmount,
      // Fee info
      contractAmountCents: rawContractAmountCents,
      feePercent: rawFeePercent,
      feeAmountCents: rawFeeAmountCents,
    } = rawBody;

    if (!currency) {
      throw new Error("Currency is required");
    }

    // Validate payment type
    const validatedPaymentType = paymentType || "contract_funding";
    if (!VALID_PAYMENT_TYPES.includes(validatedPaymentType)) {
      logStep(correlationId, "Invalid payment type", { paymentType: validatedPaymentType });
      throw new Error(`Invalid payment type: ${validatedPaymentType}`);
    }

    // ========== MONETARY NORMALIZATION (Backend is source of truth) ==========
    let baseAmountCents: number;
    let feePercent: number;
    let feeAmountCents: number;
    let totalAmountCents: number;

    if (validatedPaymentType === 'project_prefund') {
      // Validate projectId is present
      if (!projectId || typeof projectId !== 'string' || projectId.length < 10) {
        logStep(correlationId, "Missing projectId for project_prefund");
        throw new Error("Project ID is required for project prefund");
      }
      
      // Get total from input
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else if (amountInput !== undefined) {
        totalAmountCents = parseMoneyToCents(amountInput);
      } else {
        throw new Error("Amount is required");
      }
      
      // Use provided fee breakdown or calculate
      if (typeof rawFeePercent === 'number' && typeof rawFeeAmountCents === 'number') {
        feePercent = rawFeePercent;
        feeAmountCents = Math.round(rawFeeAmountCents);
        baseAmountCents = totalAmountCents - feeAmountCents;
      } else if (typeof rawContractAmountCents === 'number') {
        baseAmountCents = Math.round(rawContractAmountCents);
        feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
        feeAmountCents = Math.round(baseAmountCents * feePercent);
        totalAmountCents = baseAmountCents + feeAmountCents;
      } else {
        feePercent = DEFAULT_FEE_PERCENT;
        baseAmountCents = Math.round(totalAmountCents / (1 + feePercent));
        feeAmountCents = totalAmountCents - baseAmountCents;
      }
      
    } else if (validatedPaymentType === 'contract_funding') {
      if (!rawContractAmountCents || rawContractAmountCents <= 0) {
        throw new Error("Contract amount is required for contract funding");
      }
      
      baseAmountCents = Math.round(rawContractAmountCents);
      feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
      feeAmountCents = typeof rawFeeAmountCents === 'number' ? Math.round(rawFeeAmountCents) : Math.round(baseAmountCents * feePercent);
      
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else {
        totalAmountCents = baseAmountCents + feeAmountCents;
      }
      
    } else {
      // Other payment types (credits)
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else if (amountInput !== undefined) {
        totalAmountCents = parseMoneyToCents(amountInput);
      } else {
        throw new Error("Amount is required");
      }
      baseAmountCents = totalAmountCents;
      feePercent = 0;
      feeAmountCents = 0;
    }

    // Validate final amount
    if (!Number.isFinite(totalAmountCents) || totalAmountCents < 100) {
      logStep(correlationId, "Invalid amount", { totalAmountCents, baseAmountCents });
      throw new Error(`Invalid amount: ${totalAmountCents}`);
    }

    // Determine user type
    const resolvedUserType = userType || (
      validatedPaymentType === 'freelancer_credits' ? 'freelancer' : 'company'
    );

    logStep(correlationId, "Monetary values calculated", { 
      baseAmountCents,
      feePercent,
      feeAmountCents,
      totalAmountCents,
      currency,
      paymentType: validatedPaymentType,
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists or create one
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep(correlationId, "Found existing Stripe customer", { customerId });
    } else {
      const customer = await stripe.customers.create({ email: userEmail });
      customerId = customer.id;
      logStep(correlationId, "Created new Stripe customer", { customerId });
    }

    // Create payment record metadata
    const paymentMetadata: Record<string, unknown> = {
      milestoneIndex,
      description,
      // Monetary breakdown
      base_amount_cents: baseAmountCents,
      fee_percent: feePercent,
      fee_amount_cents: feeAmountCents,
      credits_amount: creditsAmount || null,
      // Context
      project_id: projectId || null,
      contract_amount_cents: validatedPaymentType === 'contract_funding' ? baseAmountCents : null,
    };

    // Create payment record in unified_payments
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from("unified_payments")
      .insert({
        user_id: userId,
        user_type: resolvedUserType,
        amount_cents: totalAmountCents,
        currency: currency.toUpperCase(),
        payment_type: validatedPaymentType, // CRITICAL: Use exact payment type
        provider: "stripe",
        status: "pending", // Always pending until webhook
        contract_id: contractId || null,
        credits_amount: creditsAmount || null,
        metadata: paymentMetadata,
      })
      .select()
      .single();

    if (paymentError) {
      logStep(correlationId, "Error creating payment record", { 
        error: paymentError,
        code: paymentError.code,
        message: paymentError.message,
      });
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }

    logStep(correlationId, "Created payment record", { paymentId: paymentRecord.id });

    // Create PaymentIntent with explicit payment method types
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        type: validatedPaymentType,
        paymentId: paymentRecord.id,
        contractId: contractId || "",
        projectId: projectId || "",
        milestoneIndex: String(milestoneIndex ?? ""),
        userId,
        userType: resolvedUserType,
        creditsAmount: String(creditsAmount ?? ""),
        baseAmountCents: String(baseAmountCents),
        feeAmountCents: String(feeAmountCents),
      },
    });

    logStep(correlationId, "PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      clientSecret: paymentIntent.client_secret ? "present" : "missing"
    });

    // Update payment record with Stripe PaymentIntent ID
    await supabaseAdmin
      .from("unified_payments")
      .update({ 
        provider_payment_id: paymentIntent.id,
        metadata: {
          ...paymentMetadata,
          stripe_payment_intent_id: paymentIntent.id,
        },
      })
      .eq("id", paymentRecord.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentId: paymentRecord.id,
        // Return breakdown for UI
        amountCents: totalAmountCents,
        baseAmountCents,
        feeAmountCents,
        feePercent,
        currency: currency.toUpperCase(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(correlationId, "ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
