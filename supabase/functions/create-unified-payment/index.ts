import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-UNIFIED-PAYMENT] ${step}${detailsStr}`);
};

// Validation helpers
function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 1 && 
         value <= 1000000;
}

function isValidCurrency(value: unknown): value is string {
  const supportedCurrencies = ["usd", "brl", "eur", "gbp", "aud", "cad", "chf", "jpy", "cny", "inr", "mxn"];
  return typeof value === 'string' && supportedCurrencies.includes(value.toLowerCase());
}

function isValidPaymentType(value: unknown): value is string {
  const validTypes = ["freelancer_credits", "company_wallet", "contract_funding", "contract_payment"];
  return typeof value === 'string' && validTypes.includes(value);
}

function isValidUserType(value: unknown): value is string {
  return value === 'company' || value === 'freelancer';
}

// Mercado Pago API helper
async function createMercadoPagoPreference(
  accessToken: string,
  paymentId: string,
  title: string,
  amountCents: number,
  currency: string,
  userEmail: string,
  baseUrl: string,
  isSandbox: boolean
): Promise<{ init_point: string; preference_id: string }> {
  const apiUrl = "https://api.mercadopago.com/checkout/preferences";
  
  const preference = {
    items: [{
      title: title,
      quantity: 1,
      unit_price: amountCents / 100,
      currency_id: currency.toUpperCase(),
    }],
    payer: {
      email: userEmail,
    },
    external_reference: paymentId,
    notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
    back_urls: {
      success: `${baseUrl}/settings?tab=billing&payment=success`,
      failure: `${baseUrl}/settings?tab=billing&payment=failed`,
      pending: `${baseUrl}/settings?tab=billing&payment=pending`,
    },
    auto_return: "approved",
    statement_descriptor: "Hookly",
  };

  logStep("Creating Mercado Pago preference", { paymentId, isSandbox });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logStep("Mercado Pago API error", { status: response.status, body: errorBody });
    throw new Error(`Mercado Pago API error: ${response.status}`);
  }

  const result = await response.json();
  return {
    init_point: isSandbox ? result.sandbox_init_point : result.init_point,
    preference_id: result.id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
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

    const { 
      paymentType, 
      userType, 
      amountCents, 
      currency, 
      creditsAmount,
      contractId,
      description 
    } = body as Record<string, unknown>;

    // Validate required fields
    if (!isValidPaymentType(paymentType)) {
      throw new Error("Invalid payment type");
    }
    if (!isValidUserType(userType)) {
      throw new Error("Invalid user type");
    }
    if (!isValidAmount(amountCents)) {
      throw new Error("Amount must be between 1 and 1,000,000 cents");
    }
    
    const paymentCurrency = currency || "USD";
    if (!isValidCurrency(paymentCurrency)) {
      throw new Error("Unsupported currency");
    }

    if (contractId && !isValidUUID(contractId)) {
      throw new Error("Invalid contract ID");
    }

    logStep("Request validated", { paymentType, userType, amountCents, currency: paymentCurrency });

    // Determine provider based on user's country
    let provider: "stripe" | "mercadopago" = "stripe";
    let userCountry: string | null = null;

    if (userType === 'company') {
      const { data: companyProfile } = await supabaseClient
        .from('company_profiles')
        .select('country')
        .eq('user_id', user.id)
        .single();
      
      userCountry = companyProfile?.country;
    }

    // If country is Brazil, use Mercado Pago
    if (userCountry === 'BR') {
      // Check if Mercado Pago is enabled
      const { data: mpProvider } = await supabaseAdmin
        .from('payment_providers')
        .select('is_enabled, is_sandbox')
        .eq('provider', 'mercadopago')
        .single();

      if (mpProvider?.is_enabled) {
        provider = "mercadopago";
      }
    }

    logStep("Provider determined", { provider, userCountry });

    // Generate unique external reference
    const externalReference = `${paymentType}_${user.id}_${Date.now()}`;

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('unified_payments')
      .insert({
        provider,
        payment_type: paymentType,
        user_id: user.id,
        user_type: userType,
        contract_id: contractId || null,
        amount_cents: amountCents,
        currency: paymentCurrency,
        credits_amount: creditsAmount || null,
        status: 'created',
        external_reference: externalReference,
        metadata: {
          description: description || null,
          user_email: user.email,
        },
      })
      .select()
      .single();

    if (paymentError || !payment) {
      logStep("Failed to create payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    logStep("Payment record created", { paymentId: payment.id });

    let checkoutUrl: string;
    let providerId: string;

    if (provider === "mercadopago") {
      // Get Mercado Pago config
      const { data: mpConfig } = await supabaseAdmin
        .from('payment_providers')
        .select('is_sandbox')
        .eq('provider', 'mercadopago')
        .single();

      const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!accessToken) {
        throw new Error("Mercado Pago not configured");
      }

      const title = paymentType === 'freelancer_credits' 
        ? `Comprar ${creditsAmount} Créditos de Proposta`
        : paymentType === 'company_wallet'
        ? `Adicionar Fundos na Carteira`
        : String(description) || "Pagamento Hookly";

      const result = await createMercadoPagoPreference(
        accessToken,
        payment.id,
        title,
        amountCents as number,
        paymentCurrency as string,
        user.email,
        req.headers.get("origin") || "",
        mpConfig?.is_sandbox ?? true
      );

      checkoutUrl = result.init_point;
      providerId = result.preference_id;

      // Update payment with preference ID
      await supabaseAdmin
        .from('unified_payments')
        .update({
          provider_preference_id: providerId,
          provider_checkout_url: checkoutUrl,
          status: 'pending',
        })
        .eq('id', payment.id);

    } else {
      // Use Stripe
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Check if customer exists
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string | undefined;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      const productName = paymentType === 'freelancer_credits' 
        ? `${creditsAmount} Créditos de Proposta`
        : paymentType === 'company_wallet'
        ? `Adicionar Fundos na Carteira`
        : String(description) || "Pagamento Hookly";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: (paymentCurrency as string).toLowerCase(),
            product_data: {
              name: productName,
              description: `Pagamento de ${(amountCents as number) / 100} ${paymentCurrency}`,
            },
            unit_amount: amountCents as number,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/settings?tab=billing&payment=success`,
        cancel_url: `${req.headers.get("origin")}/settings?tab=billing&payment=cancelled`,
        metadata: {
          payment_id: payment.id,
          payment_type: paymentType as string,
          user_type: userType as string,
          credits_amount: String(creditsAmount || 0),
          type: "unified_payment",
        },
      });

      checkoutUrl = session.url!;
      providerId = session.id;

      // Update payment with session ID
      await supabaseAdmin
        .from('unified_payments')
        .update({
          provider_checkout_id: providerId,
          provider_checkout_url: checkoutUrl,
          status: 'pending',
        })
        .eq('id', payment.id);
    }

    logStep("Checkout created", { provider, checkoutUrl: checkoutUrl.substring(0, 50) });

    return new Response(JSON.stringify({ 
      url: checkoutUrl, 
      paymentId: payment.id,
      provider,
    }), {
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
