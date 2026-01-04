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

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    logStep("Event type", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { sessionId: session.id });

        const metadata = session.metadata || {};
        const projectId = metadata.project_id;
        const milestoneId = metadata.milestone_id;
        const freelancerUserId = metadata.freelancer_user_id;

        if (projectId && session.payment_intent) {
          // Create payment record
          const { error: insertError } = await supabaseClient
            .from("payments")
            .insert({
              project_id: projectId,
              company_user_id: session.client_reference_id || metadata.company_user_id,
              freelancer_user_id: freelancerUserId,
              amount: (session.amount_total || 0) / 100,
              currency: session.currency?.toUpperCase() || "USD",
              status: "pending", // Funds held in escrow
              stripe_payment_intent_id: session.payment_intent as string,
              stripe_checkout_session_id: session.id,
            });

          if (insertError) {
            logStep("Error creating payment record", { error: insertError });
          } else {
            logStep("Payment record created");

            // Notify freelancer about payment held in escrow
            if (freelancerUserId) {
              await supabaseClient.from("notifications").insert({
                user_id: freelancerUserId,
                type: "payment_received",
                message: `A payment of $${(session.amount_total || 0) / 100} has been placed in escrow for your work!`,
                link: "/earnings",
              });
            }
          }
        }
        break;
      }

      case "payment_intent.amount_capturable_updated": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment ready for capture", { paymentIntentId: paymentIntent.id });
        
        // Update payment status to indicate funds are ready
        await supabaseClient
          .from("payments")
          .update({ status: "paid" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment succeeded", { paymentIntentId: paymentIntent.id });
        
        // If this was a captured payment, update to released
        if (paymentIntent.capture_method === "manual") {
          await supabaseClient
            .from("payments")
            .update({ status: "released" })
            .eq("stripe_payment_intent_id", paymentIntent.id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { paymentIntentId: paymentIntent.id });
        
        await supabaseClient
          .from("payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);
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
