import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RELEASE-PAYMENT] ${step}${detailsStr}`);
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
    logStep("Function started");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { paymentId } = await req.json();
    logStep("Request payload", { paymentId });

    // Get payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // Verify user is the company owner
    if (payment.company_user_id !== user.id) {
      throw new Error("Only the company can release payment");
    }

    if (!payment.stripe_payment_intent_id) {
      throw new Error("No payment intent found");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Capture the payment (release from escrow)
    const paymentIntent = await stripe.paymentIntents.capture(
      payment.stripe_payment_intent_id
    );
    logStep("Payment captured", { paymentIntentId: paymentIntent.id });

    // Update payment status
    const { error: updateError } = await supabaseClient
      .from("payments")
      .update({ status: "released", updated_at: new Date().toISOString() })
      .eq("id", paymentId);

    if (updateError) {
      logStep("Error updating payment status", { error: updateError });
    }

    // Notify freelancer
    if (payment.freelancer_user_id) {
      await supabaseClient.from("notifications").insert({
        user_id: payment.freelancer_user_id,
        type: "payment_released",
        message: `Payment of $${payment.amount} has been released to you!`,
        link: "/earnings",
      });
    }

    return new Response(JSON.stringify({ success: true, paymentIntent }), {
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
