import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    logStep("Webhook received");

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      logStep("Checkout session completed", { sessionId: session.id, metadata });

      // Check if this is a unified payment
      if (metadata.type === "unified_payment" && metadata.payment_id) {
        const paymentId = metadata.payment_id;
        const paymentType = metadata.payment_type;
        const creditsAmount = parseInt(metadata.credits_amount || "0", 10);
        const currency = session.currency?.toUpperCase() || "USD";

        // Find the payment record
        const { data: payment, error: findError } = await supabaseAdmin
          .from('unified_payments')
          .select('*')
          .eq('id', paymentId)
          .maybeSingle();

        if (findError || !payment) {
          logStep("Payment not found", { paymentId, error: findError });
          return new Response(JSON.stringify({ error: "Payment not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }

        // Check idempotency
        if (payment.status === 'paid') {
          logStep("Payment already processed", { paymentId });
          return new Response(JSON.stringify({ received: true, already_processed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Update payment status
        await supabaseAdmin
          .from('unified_payments')
          .update({
            status: 'paid',
            provider_payment_id: session.payment_intent as string,
            provider_checkout_id: session.id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId);

        logStep("Payment status updated to paid", { paymentId });

        // Execute financial effects using NEW LEDGER SYSTEM
        const userId = payment.user_id;
        const userType = payment.user_type;
        const amountCents = payment.amount_cents;
        const amountUnits = amountCents / 100;

        if (paymentType === 'freelancer_credits') {
          // NEW LEDGER: Use add_credits function
          logStep("Adding freelancer credits via new ledger", { userId, amount: amountUnits, creditsAmount });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('add_credits', {
              p_user_id: userId,
              p_user_type: 'freelancer',
              p_amount: creditsAmount > 0 ? creditsAmount : amountUnits,
              p_payment_id: paymentId,
              p_context: 'credits_purchase_stripe',
              p_amount_original: amountUnits,
              p_currency_original: currency,
            });

          if (rpcError) {
            logStep("Error adding credits via new ledger", { error: rpcError });
            
            // Fallback to old system
            const { error: fallbackError } = await supabaseAdmin
              .rpc('add_freelancer_credits', {
                p_freelancer_user_id: userId,
                p_credits: creditsAmount > 0 ? creditsAmount : Math.floor(amountUnits),
                p_payment_id: paymentId,
                p_reason: 'credits_purchase_stripe',
              });
            
            if (fallbackError) {
              logStep("Fallback also failed", { error: fallbackError });
            } else {
              logStep("Credits added via fallback", { userId, credits: creditsAmount });
            }
          } else {
            logStep("Freelancer credits added via new ledger", { userId, amount: creditsAmount || amountUnits, result });
          }

        } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
          // NEW LEDGER: Use add_credits for company
          logStep("Adding company credits via new ledger", { userId, amount: amountUnits });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('add_credits', {
              p_user_id: userId,
              p_user_type: 'company',
              p_amount: amountUnits,
              p_payment_id: paymentId,
              p_context: 'wallet_topup_stripe',
              p_amount_original: amountUnits,
              p_currency_original: currency,
            });

          if (rpcError) {
            logStep("Error adding company credits via new ledger", { error: rpcError });
            
            // Fallback
            const { error: fallbackError } = await supabaseAdmin
              .rpc('credit_company_wallet', {
                p_company_user_id: userId,
                p_amount_cents: amountCents,
                p_payment_id: paymentId,
                p_reason: 'wallet_topup_stripe',
              });
            
            if (fallbackError) {
              logStep("Fallback also failed", { error: fallbackError });
            } else {
              logStep("Company wallet credited via fallback", { userId, amount: amountCents });
            }
          } else {
            logStep("Company credits added via new ledger", { userId, amount: amountUnits, result });
          }

        } else if (paymentType === 'contract_funding') {
          // Contract funding: update company escrow AND freelancer earnings
          const contractId = payment.contract_id;
          
          if (contractId) {
            logStep("Funding contract", { userId, contractId, amount: amountUnits });
            
            // 1. Update company escrow via RPC
            const { data: result, error: rpcError } = await supabaseAdmin
              .rpc('fund_contract_escrow', {
                p_company_user_id: userId,
                p_contract_id: contractId,
                p_amount: amountUnits,
                p_payment_id: paymentId,
              });

            if (rpcError) {
              logStep("Error funding contract escrow", { error: rpcError });
            } else {
              logStep("Contract escrow funded", { userId, contractId, amount: amountUnits, result });
            }

            // 2. Get freelancer from contract and credit their earnings directly
            const { data: contract } = await supabaseAdmin
              .from('contracts')
              .select('freelancer_user_id, currency')
              .eq('id', contractId)
              .single();

            if (contract?.freelancer_user_id) {
              const freelancerUserId = contract.freelancer_user_id;
              logStep("Crediting freelancer earnings", { freelancerUserId, amount: amountCents });

              // Ensure freelancer balance exists
              await supabaseAdmin.rpc('ensure_user_balance', {
                p_user_id: freelancerUserId,
                p_user_type: 'freelancer',
              });

              // Get current earnings
              const { data: freelancerBalance } = await supabaseAdmin
                .from('user_balances')
                .select('earnings_available')
                .eq('user_id', freelancerUserId)
                .eq('user_type', 'freelancer')
                .single();

              const currentEarnings = freelancerBalance?.earnings_available || 0;
              const newEarnings = currentEarnings + amountCents;

              // Update freelancer earnings (directly available for withdrawal)
              const { error: updateError } = await supabaseAdmin
                .from('user_balances')
                .update({
                  earnings_available: newEarnings,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', freelancerUserId)
                .eq('user_type', 'freelancer');

              if (updateError) {
                logStep("Error updating freelancer earnings", { error: updateError });
              } else {
                logStep("Freelancer earnings credited", { freelancerUserId, newEarnings });

                // Record ledger transaction for freelancer
                await supabaseAdmin
                  .from('ledger_transactions')
                  .insert({
                    user_id: freelancerUserId,
                    tx_type: 'escrow_release',
                    amount: amountCents,
                    currency: contract.currency || 'BRL',
                    context: 'contract_funded_stripe',
                    related_contract_id: contractId,
                    related_payment_id: paymentId,
                    balance_after_earnings: newEarnings,
                  });

                // Notify freelancer
                const formattedAmount = (amountCents / 100).toFixed(2);
                await supabaseAdmin
                  .from('notifications')
                  .insert({
                    user_id: freelancerUserId,
                    type: 'payment_received',
                    message: `Você recebeu ${contract.currency || 'BRL'} ${formattedAmount}! O valor já está disponível para saque.`,
                    link: '/earnings',
                  });
                
                logStep("Freelancer notified", { freelancerUserId });
              }
            }
          } else {
            logStep("No contract_id for contract_funding payment", { paymentId });
          }
        }

        // Send notification
        let notificationMessage = '';
        if (paymentType === 'freelancer_credits') {
          notificationMessage = `Your ${creditsAmount || Math.floor(amountUnits)} proposal credits have been added!`;
        } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
          notificationMessage = `${currency} ${amountUnits.toFixed(2)} have been added to your credits!`;
        } else if (paymentType === 'contract_funding') {
          notificationMessage = `Payment of ${currency} ${amountUnits.toFixed(2)} deposited to escrow!`;
        }

        if (notificationMessage) {
          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'payment_success',
              message: notificationMessage,
              link: '/settings?tab=billing',
            });
          logStep("Notification sent", { userId });
        }
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
      status: 500,
    });
  }
});
