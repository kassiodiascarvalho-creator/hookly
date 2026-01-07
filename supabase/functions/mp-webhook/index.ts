import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MP-WEBHOOK] ${step}${detailsStr}`);
};

// Validation helpers
function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// Map Mercado Pago status to our status
function mapMPStatus(mpStatus: string): string {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "pending":
    case "in_process":
    case "authorized":
      return "pending";
    case "rejected":
    case "cancelled":
      return "failed";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "pending";
  }
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
    logStep("Webhook received");

    // Parse webhook notification
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    // Also check body for IPN notifications
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Body might be empty for some notification types
    }

    const notificationType = topic || body.type || body.topic;
    const bodyData = body.data as Record<string, unknown> | undefined;
    const resourceId = id || bodyData?.id || body.id;

    logStep("Notification parsed", { type: notificationType, resourceId });

    // Only process payment notifications
    if (notificationType !== "payment" && notificationType !== "merchant_order") {
      logStep("Ignoring non-payment notification", { type: notificationType });
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (!resourceId) {
      logStep("No resource ID found");
      return new Response(JSON.stringify({ error: "No resource ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get access token
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago not configured");
    }

    // Fetch payment details from Mercado Pago API
    let paymentData: Record<string, unknown>;
    
    if (notificationType === "payment") {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        logStep("Failed to fetch payment from MP", { status: response.status });
        throw new Error(`Failed to fetch payment: ${response.status}`);
      }

      paymentData = await response.json();
    } else if (notificationType === "merchant_order") {
      // For merchant orders, get the associated payments
      const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${resourceId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!orderResponse.ok) {
        throw new Error(`Failed to fetch merchant order: ${orderResponse.status}`);
      }

      const orderData = await orderResponse.json();
      const payments = orderData.payments || [];
      
      if (payments.length === 0) {
        logStep("No payments in merchant order");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Get the latest payment
      const latestPayment = payments[payments.length - 1];
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${latestPayment.id}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }

      paymentData = await paymentResponse.json();
    } else {
      throw new Error(`Unknown notification type: ${notificationType}`);
    }

    logStep("Payment data fetched", { 
      mpPaymentId: paymentData.id, 
      status: paymentData.status,
      externalReference: paymentData.external_reference 
    });

    const externalReference = paymentData.external_reference as string;
    const mpStatus = paymentData.status as string;
    const mpPaymentId = String(paymentData.id);
    const transactionAmount = paymentData.transaction_amount as number;
    const currencyId = (paymentData.currency_id as string) || "BRL";

    if (!externalReference) {
      logStep("No external reference found, skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Find our payment record by external_reference (which is payment.id)
    let payment;
    
    // First try to find by external_reference field
    const { data: paymentByRef } = await supabaseAdmin
      .from('unified_payments')
      .select('*')
      .eq('external_reference', externalReference)
      .maybeSingle();

    if (paymentByRef) {
      payment = paymentByRef;
    } else if (isValidUUID(externalReference)) {
      // If it's a UUID, try finding by id
      const { data: paymentById } = await supabaseAdmin
        .from('unified_payments')
        .select('*')
        .eq('id', externalReference)
        .maybeSingle();
      payment = paymentById;
    }

    if (!payment) {
      logStep("Payment record not found", { externalReference });
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    logStep("Payment record found", { paymentId: payment.id, currentStatus: payment.status });

    // Map MP status to our status
    const newStatus = mapMPStatus(mpStatus);

    // Check if already processed (idempotency)
    if (payment.status === 'paid' && newStatus === 'paid') {
      logStep("Payment already processed", { paymentId: payment.id });
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update payment record
    const updateData: Record<string, unknown> = {
      status: newStatus,
      provider_payment_id: mpPaymentId,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('unified_payments')
      .update(updateData)
      .eq('id', payment.id);

    logStep("Payment status updated", { paymentId: payment.id, newStatus });

    // If payment is approved, execute financial effects using NEW LEDGER SYSTEM
    if (newStatus === 'paid') {
      const paymentType = payment.payment_type;
      const userId = payment.user_id;
      const userType = payment.user_type;
      const amountCents = payment.amount_cents;
      const creditsAmount = payment.credits_amount;

      // Convert cents to currency units for ledger (1 BRL = 1 credit)
      const amountUnits = amountCents / 100;

      if (paymentType === 'freelancer_credits') {
        // NEW LEDGER: Use add_credits function for freelancer credits
        logStep("Adding credits via new ledger system", { userId, amount: amountUnits, creditsAmount });
        
        const { data: result, error: rpcError } = await supabaseAdmin
          .rpc('add_credits', {
            p_user_id: userId,
            p_user_type: 'freelancer',
            p_amount: creditsAmount || amountUnits, // Use credits_amount if set, else 1:1 conversion
            p_payment_id: payment.id,
            p_context: 'credits_purchase_mercadopago',
            p_amount_original: transactionAmount,
            p_currency_original: currencyId,
          });

        if (rpcError) {
          logStep("Error adding credits via ledger", { error: rpcError });
          
          // Fallback to old system if new ledger fails
          const { error: fallbackError } = await supabaseAdmin
            .rpc('add_freelancer_credits', {
              p_freelancer_user_id: userId,
              p_credits: creditsAmount || Math.floor(amountUnits),
              p_payment_id: payment.id,
              p_reason: 'credits_purchase_mercadopago',
            });
          
          if (fallbackError) {
            logStep("Fallback also failed", { error: fallbackError });
          } else {
            logStep("Credits added via fallback", { userId, credits: creditsAmount });
          }
        } else {
          logStep("Credits added via new ledger", { userId, amount: amountUnits, result });
        }

      } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
        // NEW LEDGER: Use add_credits for company top-ups
        logStep("Adding company credits via new ledger", { userId, amount: amountUnits });
        
        const { data: result, error: rpcError } = await supabaseAdmin
          .rpc('add_credits', {
            p_user_id: userId,
            p_user_type: 'company',
            p_amount: amountUnits,
            p_payment_id: payment.id,
            p_context: 'wallet_topup_mercadopago',
            p_amount_original: transactionAmount,
            p_currency_original: currencyId,
          });

        if (rpcError) {
          logStep("Error adding company credits via ledger", { error: rpcError });
          
          // Fallback to old system
          const { error: fallbackError } = await supabaseAdmin
            .rpc('credit_company_wallet', {
              p_company_user_id: userId,
              p_amount_cents: amountCents,
              p_payment_id: payment.id,
              p_reason: 'wallet_topup_mercadopago',
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
        // NEW LEDGER: Use fund_contract_escrow for contract funding
        const contractId = payment.contract_id;
        
        if (contractId) {
          logStep("Funding contract escrow via new ledger", { userId, contractId, amount: amountUnits });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('fund_contract_escrow', {
              p_company_user_id: userId,
              p_contract_id: contractId,
              p_amount: amountUnits,
              p_payment_id: payment.id,
            });

          if (rpcError) {
            logStep("Error funding contract escrow", { error: rpcError });
          } else {
            logStep("Contract escrow funded", { userId, contractId, amount: amountUnits, result });
          }
        } else {
          logStep("No contract_id for contract_funding payment", { paymentId: payment.id });
        }
      }

      // Send notification to user
      let notificationMessage = '';
      if (paymentType === 'freelancer_credits') {
        notificationMessage = `Seus ${creditsAmount || Math.floor(amountUnits)} créditos de proposta foram adicionados!`;
      } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
        notificationMessage = `${currencyId} ${amountUnits.toFixed(2)} foram adicionados aos seus créditos!`;
      } else if (paymentType === 'contract_funding') {
        notificationMessage = `Pagamento de ${currencyId} ${amountUnits.toFixed(2)} foi depositado em garantia!`;
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

    return new Response(JSON.stringify({ received: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    // Return 200 to prevent MP from retrying
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
