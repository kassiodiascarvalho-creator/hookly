import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 0.01 && 
         value <= 1000000;
}

function isValidCurrency(value: unknown): value is string {
  const supportedCurrencies = ["usd", "brl", "eur", "gbp", "aud", "cad", "chf", "jpy", "cny", "inr", "mxn"];
  return typeof value === 'string' && supportedCurrencies.includes(value.toLowerCase());
}

function isValidString(value: unknown, maxLength: number = 500): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id });

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    if (typeof body !== 'object' || body === null) {
      throw new Error("Invalid request body");
    }

    const { projectId, milestoneId, amount, description, freelancerUserId, currency } = body as Record<string, unknown>;

    // Validate required fields
    if (!isValidUUID(projectId)) {
      throw new Error("Invalid or missing projectId");
    }

    if (milestoneId !== undefined && milestoneId !== null && !isValidString(milestoneId, 100)) {
      throw new Error("Invalid milestoneId");
    }

    if (!isValidAmount(amount)) {
      throw new Error("Amount must be a positive number between 0.01 and 1,000,000");
    }

    if (description !== undefined && description !== null && !isValidString(description, 500)) {
      throw new Error("Description must be a string with max 500 characters");
    }

    if (freelancerUserId !== undefined && freelancerUserId !== null && !isValidUUID(freelancerUserId)) {
      throw new Error("Invalid freelancerUserId");
    }

    // Validate currency - default to USD if not provided
    const paymentCurrency = currency || "USD";
    if (!isValidCurrency(paymentCurrency)) {
      throw new Error("Unsupported currency. Supported: USD, BRL, EUR, GBP, AUD, CAD, CHF, JPY, CNY, INR, MXN");
    }

    logStep("Request validated", { projectId, amount, currency: paymentCurrency });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
      logStep("New Stripe customer created", { customerId });

      // Save customer ID to profiles
      await supabaseClient
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const origin = req.headers.get("origin") || "https://lovable.dev";
    
    // Create checkout session for milestone payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (paymentCurrency as string).toLowerCase(),
            product_data: {
              name: (description as string | undefined) || "Project Milestone Payment",
              metadata: {
                project_id: projectId as string,
                milestone_id: (milestoneId as string) || "",
              }
            },
            unit_amount: Math.round((amount as number) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual", // This enables escrow-like behavior
        metadata: {
          project_id: projectId as string,
          milestone_id: (milestoneId as string) || "",
          freelancer_user_id: (freelancerUserId as string) || "",
          company_user_id: user.id,
        }
      },
      success_url: `${origin}/projects/${projectId}?payment=success`,
      cancel_url: `${origin}/projects/${projectId}?payment=cancelled`,
      metadata: {
        project_id: projectId as string,
        milestone_id: (milestoneId as string) || "",
        freelancer_user_id: (freelancerUserId as string) || "",
      }
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
