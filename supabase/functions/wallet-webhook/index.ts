import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WALLET-WEBHOOK] ${step}${detailsStr}`);
};

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
    const amount = parseFloat(session.metadata?.topup_amount_contracts || "0");
    const currency = session.metadata?.currency || "USD";
    const fiatAmount = parseFloat(session.metadata?.fiat_amount || "0");

    if (!userId || amount <= 0) {
      logStep("Invalid metadata", { userId, amount });
      return new Response("Invalid metadata", { status: 400 });
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
