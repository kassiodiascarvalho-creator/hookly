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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
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
    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Client com contexto do usuário para checagem de admin
    const supabaseUserContext = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

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

    if (!isValidUUID(paymentId)) {
      throw new Error("Invalid or missing paymentId");
    }

    logStep("Request validated", { paymentId });

    // Get payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // IDEMPOTENCY: Already released
    if (payment.status === 'released') {
      logStep("Payment already released - idempotent return", { paymentId });
      return new Response(JSON.stringify({ 
        success: true, 
        alreadyReleased: true,
        message: "Payment was already released" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Admin check com contexto do usuário
    const { data: isAdminResult } = await supabaseUserContext.rpc('is_admin');
    const isAdmin = isAdminResult === true;
    logStep("Admin check", { isAdmin, userId: user.id });

    if (payment.company_user_id !== user.id && !isAdmin) {
      throw new Error("Only the company or admin can release payment");
    }

    if (payment.status !== 'paid') {
      throw new Error(`Cannot release payment with status '${payment.status}'. Payment must be in 'paid' status.`);
    }

    const isAdminOverride = isAdmin && payment.company_user_id !== user.id;

    if (!payment.stripe_payment_intent_id) {
      throw new Error("No payment intent found");
    }

    // =========================================================================
    // STEP 1: Find contract BEFORE Stripe capture (fail fast)
    // =========================================================================
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("project_id", payment.project_id)
      .eq("company_user_id", payment.company_user_id)
      .eq("freelancer_user_id", payment.freelancer_user_id)
      .single();

    if (contractError || !contract) {
      logStep("ERROR: No contract found - aborting before Stripe capture", { 
        paymentId, projectId: payment.project_id, error: contractError?.message
      });
      
      await supabaseAdmin.from("payment_logs").insert({
        payment_id: paymentId,
        action: "release_no_contract",
        admin_user_id: isAdminOverride ? user.id : null,
        details: { 
          reason: "No contract found - manual reconciliation required",
          projectId: payment.project_id,
          companyUserId: payment.company_user_id,
          freelancerUserId: payment.freelancer_user_id
        },
      });

      return new Response(JSON.stringify({ 
        error: "No contract found for this payment. Manual reconciliation required.",
        paymentId,
        requiresReconciliation: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Contract found", { contractId: contract.id });

    // =========================================================================
    // STEP 2: Capture the payment in Stripe (idempotent)
    // =========================================================================
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(payment.stripe_payment_intent_id);
      logStep("Payment captured in Stripe", { paymentIntentId: paymentIntent.id });
    } catch (stripeError: unknown) {
      const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError);
      if (errorMessage.includes('already been captured') || errorMessage.includes('has already been')) {
        logStep("Payment already captured in Stripe - continuing", { paymentId });
        paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
      } else {
        throw stripeError;
      }
    }

    // =========================================================================
    // STEP 3: Call RPC to update balances (REQUIRED)
    // =========================================================================
    const { data: releaseResult, error: releaseError } = await supabaseAdmin.rpc(
      'release_escrow_to_earnings',
      {
        p_company_user_id: payment.company_user_id,
        p_freelancer_user_id: payment.freelancer_user_id,
        p_contract_id: contract.id,
        p_amount: payment.amount,
        p_context: 'legacy_release_payment:' + paymentId,
        p_payment_id: paymentId
      }
    );

    if (releaseError) {
      logStep("ERROR: RPC failed - cannot release", { 
        error: releaseError.message, paymentId, contractId: contract.id, amount: payment.amount
      });
      
      await supabaseAdmin.from("payment_logs").insert({
        payment_id: paymentId,
        action: "release_rpc_failed",
        admin_user_id: isAdminOverride ? user.id : null,
        details: { 
          error: releaseError.message,
          contractId: contract.id,
          amount: payment.amount,
          stripePaymentIntentId: payment.stripe_payment_intent_id
        },
      });

      return new Response(JSON.stringify({ 
        error: `Failed to update balances: ${releaseError.message}. Manual reconciliation required.`,
        paymentId,
        requiresReconciliation: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Balances updated via RPC", { releaseResult, contractId: contract.id });

    // =========================================================================
    // STEP 4: Update payment status (only if RPC succeeded)
    // =========================================================================
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from("payments")
      .update({ 
        status: "released", 
        released_at: new Date().toISOString(),
        released_by_admin_id: isAdminOverride ? user.id : null,
        updated_at: new Date().toISOString() 
      })
      .eq("id", paymentId)
      .eq("status", "paid")
      .select();

    if (updateError) {
      logStep("Error updating payment status", { error: updateError.message });
      throw new Error("Failed to update payment status");
    }

    if (!updateResult || updateResult.length === 0) {
      logStep("Payment status already changed - idempotent return", { paymentId });
      return new Response(JSON.stringify({ 
        success: true, 
        alreadyReleased: true,
        message: "Payment was already processed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Payment status updated to released", { paymentId });

    if (isAdminOverride) {
      await supabaseAdmin.from("payment_logs").insert({
        payment_id: paymentId,
        action: "admin_release",
        admin_user_id: user.id,
        details: { reason: "Admin override release" },
      });
      logStep("Admin override logged");
    }

    // =========================================================================
    // STEP 5: Notify freelancer (with deduplication)
    // =========================================================================
    if (payment.freelancer_user_id) {
      const { data: existingNotification } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", payment.freelancer_user_id)
        .eq("type", "payment_released")
        .gte("created_at", new Date(Date.now() - 60000).toISOString())
        .maybeSingle();

      if (!existingNotification) {
        await supabaseAdmin.from("notifications").insert({
          user_id: payment.freelancer_user_id,
          type: "payment_released",
          message: `Payment of $${payment.amount} has been released to you!`,
          link: "/earnings",
        });
        logStep("Freelancer notified");
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      paymentIntent,
      balancesUpdated: true
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
