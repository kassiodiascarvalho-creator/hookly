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

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string | undefined | null): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function isValidPositiveNumber(value: number): boolean {
  return !isNaN(value) && isFinite(value) && value > 0 && value <= 10000000;
}

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

    // Validate webhook signature (required)
    if (!webhookSecret || !sig) {
      logStep("Missing webhook secret or signature");
      return new Response(JSON.stringify({ error: "Missing webhook configuration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

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
        const currency = session.currency?.toUpperCase() || "USD";
        
        // Check if this is a wallet topup (legacy)
        if (metadata.type === "wallet_topup") {
          logStep("Processing wallet topup via legacy flow");
          const userId = metadata.user_id;
          const amountStr = metadata.topup_amount_contracts || "0";
          const fiatAmountStr = metadata.fiat_amount || "0";

          if (!isValidUUID(userId)) {
            logStep("Invalid user_id in wallet topup metadata", { userId });
            break;
          }

          const amount = parseFloat(amountStr);
          const fiatAmount = parseFloat(fiatAmountStr);

          if (!isValidPositiveNumber(amount)) {
            logStep("Invalid amount in wallet topup metadata", { amount: amountStr });
            break;
          }

          // NEW LEDGER: Use add_credits for company credits
          logStep("Adding company credits via new ledger", { userId, amount });
          
          const { data: result, error: rpcError } = await supabaseClient
            .rpc('add_credits', {
              p_user_id: userId,
              p_user_type: 'company',
              p_amount: amount,
              p_payment_id: session.id,
              p_context: 'wallet_topup_stripe_legacy',
              p_amount_original: fiatAmount,
              p_currency_original: currency,
            });

          if (rpcError) {
            logStep("Error adding credits via new ledger, trying fallback", { error: rpcError });
            
            const { data, error } = await supabaseClient.rpc("credit_wallet", {
              p_user_id: userId,
              p_amount: amount,
              p_session_id: session.id,
              p_currency: currency,
              p_fiat_amount: fiatAmount,
            });

            if (error) {
              logStep("Fallback credit_wallet also failed", { error: error.message });
            } else if (data === false) {
              logStep("Wallet transaction already processed (idempotent)");
            } else {
              logStep("Wallet credited via fallback", { userId, amount });
            }
          } else {
            logStep("Company credits added via new ledger", { userId, amount, result });
          }
          
          // Notify user
          await supabaseClient.from("notifications").insert({
            user_id: userId,
            type: "wallet_topup",
            message: `${amount} credits have been added to your account!`,
            link: "/settings?tab=billing",
          });
          break;
        }

        // Regular project payment handling
        const projectId = metadata.project_id;
        const milestoneId = metadata.milestone_id;
        const freelancerUserId = metadata.freelancer_user_id;
        const companyUserId = session.client_reference_id || metadata.company_user_id;
        const contractId = metadata.contract_id;

        // Validate UUIDs before proceeding
        if (projectId && !isValidUUID(projectId)) {
          logStep("Invalid project_id in metadata", { projectId });
          break;
        }

        if (freelancerUserId && !isValidUUID(freelancerUserId)) {
          logStep("Invalid freelancer_user_id in metadata", { freelancerUserId });
          break;
        }

        if (companyUserId && !isValidUUID(companyUserId)) {
          logStep("Invalid company_user_id in metadata", { companyUserId });
          break;
        }

        logStep("Extracted metadata", { projectId, milestoneId, freelancerUserId, companyUserId, contractId });

        if (projectId && session.payment_intent) {
          const amount = (session.amount_total || 0) / 100;
          if (!isValidPositiveNumber(amount)) {
            logStep("Invalid amount from Stripe session", { amount: session.amount_total });
            break;
          }

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
              amount: amount,
              currency: currency,
              status: "paid",
              escrow_status: "held",
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_checkout_session_id: session.id,
              paid_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (insertError) {
            logStep("Error creating payment record", { error: insertError.message });
          } else {
            logStep("Payment record created", { paymentId: payment.id });

            // NEW LEDGER: If there's a contract, fund escrow via new ledger system
            if (contractId && isValidUUID(contractId) && companyUserId) {
              logStep("Funding contract escrow via new ledger", { companyUserId, contractId, amount });
              
              const { data: escrowResult, error: escrowError } = await supabaseClient
                .rpc('fund_contract_escrow', {
                  p_company_user_id: companyUserId,
                  p_contract_id: contractId,
                  p_amount: amount,
                  p_payment_id: payment.id,
                });

              if (escrowError) {
                logStep("Error funding escrow via new ledger", { error: escrowError });
              } else {
                logStep("Contract escrow funded via new ledger", { contractId, amount, result: escrowResult });
              }
            }

            // Log the payment creation
            await supabaseClient.from("payment_logs").insert({
              payment_id: payment.id,
              action: "payment_created",
              details: {
                stripe_session_id: session.id,
                stripe_payment_intent_id: session.payment_intent,
                amount: amount,
                currency: currency,
                source: "stripe_webhook",
                ledger_system: "v2"
              }
            });

            // Notify freelancer about payment held in escrow
            if (freelancerUserId) {
              await supabaseClient.from("notifications").insert({
                user_id: freelancerUserId,
                type: "payment_received",
                message: `A payment of ${currency} ${amount.toFixed(2)} has been placed in escrow for your work!`,
                link: "/earnings",
              });
              logStep("Freelancer notified", { freelancerUserId });
            }

            // Notify company about successful payment
            if (companyUserId) {
              await supabaseClient.from("notifications").insert({
                user_id: companyUserId,
                type: "payment_success",
                message: `Your payment of ${currency} ${amount.toFixed(2)} has been processed and is held in escrow.`,
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
