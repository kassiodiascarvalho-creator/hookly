import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WALLET-WEBHOOK] ${step}${detailsStr}`);
};

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string | undefined | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidPositiveNumber(value: number): boolean {
  return !isNaN(value) && isFinite(value) && value > 0 && value <= 1000000;
}

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );
    logStep("Webhook signature verified", { type: event.type });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logStep("Webhook signature verification failed", { error: errorMessage });
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Only handle checkout.session.completed for wallet topups
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Check if this is a wallet topup
    if (session.metadata?.type !== "wallet_topup") {
      logStep("Not a wallet topup, skipping", { metadata: session.metadata });
      return new Response("OK", { status: 200 });
    }

    const userId = session.metadata?.user_id;
    const amountStr = session.metadata?.topup_amount_contracts || "0";
    const currency = session.metadata?.currency || "USD";
    const fiatAmountStr = session.metadata?.fiat_amount || "0";

    // Validate userId
    if (!isValidUUID(userId)) {
      logStep("Invalid user_id in metadata", { userId });
      return new Response("Invalid user_id in metadata", { status: 400 });
    }

    // Parse and validate amounts
    const amount = parseFloat(amountStr);
    const fiatAmount = parseFloat(fiatAmountStr);

    if (!isValidPositiveNumber(amount)) {
      logStep("Invalid amount in metadata", { amount: amountStr });
      return new Response("Invalid amount in metadata", { status: 400 });
    }

    if (!isValidPositiveNumber(fiatAmount)) {
      logStep("Invalid fiat_amount in metadata", { fiatAmount: fiatAmountStr });
      return new Response("Invalid fiat_amount in metadata", { status: 400 });
    }

    logStep("Processing wallet topup", { userId, amount, currency, sessionId: session.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Call the credit_wallet function for idempotent credit
    const { data, error } = await supabaseAdmin.rpc("credit_wallet", {
      p_user_id: userId,
      p_amount: amount,
      p_session_id: session.id,
      p_currency: currency,
      p_fiat_amount: fiatAmount,
    });

    if (error) {
      logStep("Error crediting wallet", { error: error.message });
      return new Response(`Database Error: ${error.message}`, { status: 500 });
    }

    if (data === false) {
      logStep("Transaction already processed (idempotent)", { sessionId: session.id });
    } else {
      logStep("Wallet credited successfully", { userId, amount });
    }
  }

  return new Response("OK", { status: 200 });
});
