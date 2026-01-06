import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Webhook received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    // Validate webhook signature
    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errorMsg });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
      // For testing without webhook secret (not recommended in production)
      event = JSON.parse(body);
      logStep("WARNING: Processing without signature verification");
    }

    logStep("Event type", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { 
          sessionId: session.id,
          paymentIntent: session.payment_intent,
          amount: session.amount_total
        });

        const metadata = session.metadata || {};
        
        // Check if this is a wallet topup
        if (metadata.type === "wallet_topup") {
          logStep("Processing wallet topup");
          const userId = metadata.user_id;
          const amount = parseFloat(metadata.topup_amount_contracts || "0");
          const currency = metadata.currency || "USD";
          const fiatAmount = parseFloat(metadata.fiat_amount || "0");

          if (userId && amount > 0) {
            const { data, error } = await supabaseClient.rpc("credit_wallet", {
              p_user_id: userId,
              p_amount: amount,
              p_session_id: session.id,
              p_currency: currency,
              p_fiat_amount: fiatAmount,
            });

            if (error) {
              logStep("Error crediting wallet", { error: error.message });
            } else if (data === false) {
              logStep("Wallet transaction already processed (idempotent)");
            } else {
              logStep("Wallet credited successfully", { userId, amount });
              
              // Notify user
              await supabaseClient.from("notifications").insert({
                user_id: userId,
                type: "wallet_topup",
                message: `${amount} Contracts have been added to your wallet!`,
                link: "/settings?tab=billing",
              });
            }
          }
          break;
        }

        // Regular project payment handling
        const projectId = metadata.project_id;
        const milestoneId = metadata.milestone_id;
        const freelancerUserId = metadata.freelancer_user_id;
        const companyUserId = session.client_reference_id || metadata.company_user_id;

        logStep("Extracted metadata", { projectId, milestoneId, freelancerUserId, companyUserId });

        if (projectId && session.payment_intent) {
          // Check if payment already exists
          const { data: existingPayment } = await supabaseClient
            .from("payments")
            .select("id")
            .eq("stripe_payment_intent_id", session.payment_intent as string)
            .maybeSingle();

          if (existingPayment) {
            logStep("Payment already exists, skipping", { paymentId: existingPayment.id });
            break;
          }

          // Create payment record with status 'paid' and escrow_status 'held'
          const { data: payment, error: insertError } = await supabaseClient
            .from("payments")
            .insert({
              project_id: projectId,
              company_user_id: companyUserId,
              freelancer_user_id: freelancerUserId,
              amount: (session.amount_total || 0) / 100,
              currency: session.currency?.toUpperCase() || "USD",
              status: "paid",
              escrow_status: "held",
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_checkout_session_id: session.id,
              paid_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            logStep("Error creating payment record", { error: insertError });
          } else {
            logStep("Payment record created", { paymentId: payment.id });

            // Log the payment creation
            await supabaseClient.from("payment_logs").insert({
              payment_id: payment.id,
              action: "payment_created",
              details: {
                stripe_session_id: session.id,
                stripe_payment_intent_id: session.payment_intent,
                amount: (session.amount_total || 0) / 100,
                currency: session.currency?.toUpperCase() || "USD",
                source: "stripe_webhook"
              }
            });

            // Notify freelancer about payment held in escrow
            if (freelancerUserId) {
              await supabaseClient.from("notifications").insert({
                user_id: freelancerUserId,
                type: "payment_received",
                message: `A payment of $${(session.amount_total || 0) / 100} has been placed in escrow for your work!`,
                link: "/earnings",
              });
              logStep("Freelancer notified", { freelancerUserId });
            }

            // Notify company about successful payment
            if (companyUserId) {
              await supabaseClient.from("notifications").insert({
                user_id: companyUserId,
                type: "payment_success",
                message: `Your payment of $${(session.amount_total || 0) / 100} has been processed and is held in escrow.`,
                link: "/finances",
              });
              logStep("Company notified", { companyUserId });
            }
          }
        } else {
          logStep("Missing project_id or payment_intent, skipping");
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent succeeded", { paymentIntentId: paymentIntent.id });
        
        // Update payment if it exists
        const { error } = await supabaseClient
          .from("payments")
          .update({ 
            status: "paid",
            paid_at: new Date().toISOString()
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .eq("status", "pending");

        if (!error) {
          logStep("Payment status updated to paid");
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { paymentIntentId: paymentIntent.id });
        
        const { error } = await supabaseClient
          .from("payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (!error) {
          // Get payment to notify users
          const { data: payment } = await supabaseClient
            .from("payments")
            .select("company_user_id, freelancer_user_id")
            .eq("stripe_payment_intent_id", paymentIntent.id)
            .maybeSingle();

          if (payment?.company_user_id) {
            await supabaseClient.from("notifications").insert({
              user_id: payment.company_user_id,
              type: "payment_failed",
              message: "Your payment failed. Please try again.",
              link: "/finances",
            });
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        logStep("Charge refunded", { chargeId: charge.id, paymentIntent: charge.payment_intent });
        
        if (charge.payment_intent) {
          await supabaseClient
            .from("payments")
            .update({ 
              status: "failed",
              escrow_status: "refunded"
            })
            .eq("stripe_payment_intent_id", charge.payment_intent as string);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
