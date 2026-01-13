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

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
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
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");
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

    const { paymentId } = body as Record<string, unknown>;

    // Validate paymentId
    if (!isValidUUID(paymentId)) {
      throw new Error("Invalid or missing paymentId");
    }

    logStep("Request validated", { paymentId });

    // Get payment record
    const { data: payment, error: paymentError } = await supabaseClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // Check if user is admin
    const { data: isAdminResult } = await supabaseClient.rpc('is_admin');
    const isAdmin = isAdminResult === true;
    logStep("Admin check", { isAdmin });

    // Verify user is the company owner OR an admin
    if (payment.company_user_id !== user.id && !isAdmin) {
      throw new Error("Only the company or admin can release payment");
    }

    // Validate payment is in correct state for release
    if (payment.status !== 'paid') {
      throw new Error(`Cannot release payment with status '${payment.status}'. Payment must be in 'paid' status.`);
    }

    // Track if this is an admin override release
    const isAdminOverride = isAdmin && payment.company_user_id !== user.id;

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

    // Log admin override action if applicable
    if (isAdminOverride) {
      await supabaseClient.from("payment_logs").insert({
        payment_id: paymentId,
        action: "admin_release",
        admin_user_id: user.id,
        details: { reason: "Admin override release" },
      });
      logStep("Admin override logged");
    }

    // Update payment status with admin tracking
    const { error: updateError } = await supabaseClient
      .from("payments")
      .update({ 
        status: "released", 
        released_at: new Date().toISOString(),
        released_by_admin_id: isAdminOverride ? user.id : null,
        updated_at: new Date().toISOString() 
      })
      .eq("id", paymentId);

    if (updateError) {
      logStep("Error updating payment status", { error: updateError.message });
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
      status: 400,
    });
  }
});
