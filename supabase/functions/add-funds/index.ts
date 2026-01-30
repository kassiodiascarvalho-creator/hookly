import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SAFE_CORS_HEADERS, SECURITY_HEADERS, safeLog } from "../_shared/security.ts";

const corsHeaders = SAFE_CORS_HEADERS;

const logStep = (step: string, details?: unknown) => {
  safeLog("ADD-FUNDS", step, details as Record<string, unknown> | undefined);
};

// Validation helpers
function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 1 && 
         value <= 100000;
}

function isValidCurrency(value: unknown): value is string {
  const supportedCurrencies = ["usd", "brl", "eur", "gbp", "aud", "cad", "chf", "jpy", "cny", "inr", "mxn"];
  return typeof value === 'string' && supportedCurrencies.includes(value.toLowerCase());
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
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
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

    const { amount, currency } = body as Record<string, unknown>;

    // Validate amount
    if (!isValidAmount(amount)) {
      throw new Error("Amount must be a positive number between 1 and 100,000");
    }

    // Validate currency - default to USD if not provided
    const paymentCurrency = currency || "USD";
    if (!isValidCurrency(paymentCurrency)) {
      throw new Error("Unsupported currency. Supported: USD, BRL, EUR, GBP, AUD, CAD, CHF, JPY, CNY, INR, MXN");
    }

    logStep("Request validated", { amount, currency: paymentCurrency });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Amount in cents/minor units
    const amountInCents = Math.round((amount as number) * 100);

    // Create checkout session with dynamic price
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (paymentCurrency as string).toLowerCase(),
            product_data: {
              name: `Add ${amount} Contracts`,
              description: `Add ${paymentCurrency} ${amount} to your wallet balance`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/settings?tab=billing&success=true`,
      cancel_url: `${req.headers.get("origin")}/settings?tab=billing&canceled=true`,
      metadata: {
        user_id: user.id,
        topup_amount_contracts: String(amount),
        currency: paymentCurrency as string,
        fiat_amount: String(amount),
        type: "wallet_topup",
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
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
