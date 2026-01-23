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

  // Create admin client for database operations
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
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // IDEMPOTENCY CHECK: If already released, return success
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

    // Check if user is admin
    const { data: isAdminResult } = await supabaseAdmin.rpc('is_admin');
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

    // =========================================================================
    // STEP 1: Capture the payment in Stripe (idempotent)
    // =========================================================================
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.capture(
        payment.stripe_payment_intent_id
      );
      logStep("Payment captured in Stripe", { paymentIntentId: paymentIntent.id });
    } catch (stripeError: unknown) {
      // Handle already captured case (Stripe is idempotent)
      const errorMessage = stripeError instanceof Error ? stripeError.message : String(stripeError);
      if (errorMessage.includes('already been captured') || errorMessage.includes('has already been')) {
        logStep("Payment already captured in Stripe - continuing", { paymentId });
        paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
      } else {
        throw stripeError;
      }
    }

    // =========================================================================
    // STEP 2: Find contract for this payment
    // =========================================================================
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("project_id", payment.project_id)
      .eq("company_user_id", payment.company_user_id)
      .eq("freelancer_user_id", payment.freelancer_user_id)
      .single();

    if (contractError || !contract) {
      // Log error but don't fail - log for manual reconciliation
      logStep("WARNING: No contract found for payment - balance update will be skipped", { 
        paymentId,
        projectId: payment.project_id,
        error: contractError?.message
      });
      
      // Log this for manual reconciliation
      await supabaseAdmin.from("payment_logs").insert({
        payment_id: paymentId,
        action: "release_no_contract",
        admin_user_id: isAdminOverride ? user.id : null,
        details: { 
          reason: "No contract found - manual reconciliation needed",
          projectId: payment.project_id,
          companyUserId: payment.company_user_id,
          freelancerUserId: payment.freelancer_user_id
        },
      });
    }

    // =========================================================================
    // STEP 3: Call RPC to update balances (if contract exists)
    // Uses p_payment_id for idempotency (advisory lock + metadata check)
    // =========================================================================
    let rpcSuccess = false;
    if (contract) {
      // payment.amount is already in the correct unit (as stored in payments table)
      const { data: releaseResult, error: releaseError } = await supabaseAdmin.rpc(
        'release_escrow_to_earnings',
        {
          p_company_user_id: payment.company_user_id,
          p_freelancer_user_id: payment.freelancer_user_id,
          p_contract_id: contract.id,
          p_amount: payment.amount, // Use as-is, no unit conversion
          p_context: 'legacy_release_payment:' + paymentId,
          p_payment_id: paymentId // Enables idempotency in the RPC
        }
      );

      if (releaseError) {
        // Check if it's an "insufficient escrow" error
        if (releaseError.message?.includes('Insufficient escrow')) {
          logStep("ERROR: Insufficient escrow - cannot release", { 
            error: releaseError.message,
            paymentId,
            amount: payment.amount
          });
          
          // Log for reconciliation
          await supabaseAdmin.from("payment_logs").insert({
            payment_id: paymentId,
            action: "release_insufficient_escrow",
            admin_user_id: isAdminOverride ? user.id : null,
            details: { 
              error: releaseError.message,
              amount: payment.amount,
              contractId: contract.id
            },
          });
          
          // DON'T mark as released - return error for reconciliation
          throw new Error(`Failed to release: ${releaseError.message}. Manual reconciliation required.`);
        }
        
        // Other RPC errors - log but continue (Stripe already captured)
        logStep("WARNING: RPC failed but Stripe captured - logging for reconciliation", { 
          error: releaseError.message,
          paymentId
        });
        
        await supabaseAdmin.from("payment_logs").insert({
          payment_id: paymentId,
          action: "release_rpc_failed",
          admin_user_id: isAdminOverride ? user.id : null,
          details: { 
            error: releaseError.message,
            contractId: contract.id,
            amount: payment.amount
          },
        });
      } else {
        rpcSuccess = true;
        logStep("Balances updated via RPC", { releaseResult, contractId: contract.id });
      }
    }

    // =========================================================================
    // STEP 4: Update payment status (conditional - only if still 'paid')
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
      .eq("status", "paid") // Only update if still in 'paid' status
      .select();

    if (updateError) {
      logStep("Error updating payment status", { error: updateError.message });
      throw new Error("Failed to update payment status");
    }

    // If no rows updated, another request already processed this
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

    logStep("Payment status updated to released", { paymentId, rpcSuccess });

    // Log admin override action if applicable
    if (isAdminOverride) {
      await supabaseAdmin.from("payment_logs").insert({
        payment_id: paymentId,
        action: "admin_release",
        admin_user_id: user.id,
        details: { reason: "Admin override release", rpcSuccess },
      });
      logStep("Admin override logged");
    }

    // =========================================================================
    // STEP 5: Notify freelancer (with deduplication)
    // =========================================================================
    if (payment.freelancer_user_id) {
      // Check if notification already sent in last 60 seconds
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
      rpcSuccess,
      balancesUpdated: rpcSuccess
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
