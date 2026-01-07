import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CARD-PAYMENT] ${step}${detailsStr}`);
};

// Validation helpers
function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 100 && 
         value <= 100000000; // 1 to 1,000,000 BRL in cents
}

function isValidPaymentType(value: unknown): value is string {
  const validTypes = ["freelancer_credits", "company_wallet", "contract_funding"];
  return typeof value === 'string' && validTypes.includes(value);
}

function isValidUserType(value: unknown): value is string {
  return value === 'company' || value === 'freelancer';
}

function isValidString(value: unknown, minLength = 1, maxLength = 500): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
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

    const { 
      token: cardToken,
      paymentMethodId,
      issuerId,
      installments,
      transactionAmount,
      payerEmail,
      payerDocType,
      payerDocNumber,
      paymentType, 
      userType, 
      amountCents, 
      creditsAmount,
      description,
      contractId,
      freelancerUserId,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (!isValidString(cardToken, 10, 500)) {
      throw new Error("Invalid card token");
    }
    if (!isValidPaymentType(paymentType)) {
      throw new Error("Invalid payment type");
    }
    if (!isValidUserType(userType)) {
      throw new Error("Invalid user type");
    }
    if (!isValidAmount(amountCents)) {
      throw new Error("Amount must be between R$1 and R$1,000,000");
    }

    // Validate contract ID if contract_funding
    if (paymentType === 'contract_funding') {
      if (typeof contractId !== 'string' || contractId.length < 10) {
        throw new Error("Contract ID is required for contract funding");
      }
    }

    logStep("Request validated", { paymentType, userType, amountCents, installments, contractId });

    // Get Mercado Pago access token
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago not configured");
    }

    // Generate unique idempotency key
    const idempotencyKey = `card_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record first
    const paymentInsert: Record<string, unknown> = {
      provider: 'mercadopago',
      payment_type: paymentType as string,
      user_id: user.id,
      user_type: userType as string,
      amount_cents: amountCents as number,
      currency: 'BRL',
      credits_amount: (creditsAmount as number) || null,
      status: 'pending',
      external_reference: idempotencyKey,
      metadata: {
        description: description || null,
        user_email: user.email,
        payment_method: 'card',
        freelancer_user_id: freelancerUserId || null,
      },
    };

    // Add contract_id if contract funding
    if (paymentType === 'contract_funding' && contractId) {
      paymentInsert.contract_id = contractId;
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('unified_payments')
      .insert(paymentInsert)
      .select()
      .single();

    if (paymentError || !payment) {
      logStep("Failed to create payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    logStep("Payment record created", { paymentId: payment.id });

    // Create card payment via Mercado Pago API
    const paymentDescription = paymentType === 'freelancer_credits' 
      ? `${creditsAmount} Créditos de Proposta - Hookly`
      : paymentType === 'company_wallet'
      ? `Fundos na Carteira - Hookly`
      : paymentType === 'contract_funding'
      ? String(description) || "Financiamento de Contrato - Hookly"
      : String(description) || "Pagamento Hookly";

    const mpPaymentBody: Record<string, unknown> = {
      transaction_amount: Number(transactionAmount) || (amountCents as number) / 100,
      token: cardToken,
      description: paymentDescription,
      installments: Number(installments) || 1,
      payment_method_id: paymentMethodId || undefined,
      issuer_id: issuerId ? Number(issuerId) : undefined,
      payer: {
        email: payerEmail || user.email,
        identification: payerDocType && payerDocNumber ? {
          type: payerDocType,
          number: payerDocNumber,
        } : undefined,
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      external_reference: payment.id,
    };

    // Clean up undefined values
    Object.keys(mpPaymentBody).forEach(key => {
      if (mpPaymentBody[key] === undefined) {
        delete mpPaymentBody[key];
      }
    });
    if (mpPaymentBody.payer && typeof mpPaymentBody.payer === 'object') {
      const payer = mpPaymentBody.payer as Record<string, unknown>;
      Object.keys(payer).forEach(key => {
        if (payer[key] === undefined) {
          delete payer[key];
        }
      });
    }

    logStep("Creating Mercado Pago card payment", { 
      amount: mpPaymentBody.transaction_amount,
      installments: mpPaymentBody.installments,
    });

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPaymentBody),
    });

    const mpPayment = await mpResponse.json();

    if (!mpResponse.ok) {
      logStep("Mercado Pago API error", { 
        status: mpResponse.status, 
        error: mpPayment 
      });
      
      // Update payment record with error
      await supabaseAdmin
        .from('unified_payments')
        .update({
          status: 'failed',
          metadata: {
            description: description || null,
            user_email: user.email,
            payment_method: 'card',
            error: mpPayment.message || 'API error',
            error_detail: mpPayment.cause || null,
          },
        })
        .eq('id', payment.id);
      
      throw new Error(mpPayment.message || `Mercado Pago API error: ${mpResponse.status}`);
    }

    logStep("Mercado Pago payment created", { 
      mpPaymentId: mpPayment.id, 
      status: mpPayment.status,
      statusDetail: mpPayment.status_detail,
    });

    // Map MP status to our status
    let ourStatus = 'pending';
    if (mpPayment.status === 'approved') {
      ourStatus = 'paid';
    } else if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
      ourStatus = 'failed';
    }

    // Update payment record
    const updateData: Record<string, unknown> = {
      provider_payment_id: String(mpPayment.id),
      status: ourStatus,
      metadata: {
        description: description || null,
        user_email: user.email,
        payment_method: 'card',
        mp_status: mpPayment.status,
        mp_status_detail: mpPayment.status_detail,
        payment_method_id: mpPayment.payment_method_id,
        installments: mpPayment.installments,
      },
    };

    if (ourStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('unified_payments')
      .update(updateData)
      .eq('id', payment.id);

    logStep("Payment record updated", { status: ourStatus });

    // If payment is approved, execute financial effects immediately
    if (ourStatus === 'paid') {
      if (paymentType === 'freelancer_credits' && creditsAmount) {
        const { error: rpcError } = await supabaseAdmin
          .rpc('add_freelancer_credits', {
            p_freelancer_user_id: user.id,
            p_credits: creditsAmount as number,
            p_payment_id: payment.id,
            p_reason: 'credits_purchase_mercadopago_card',
          });

        if (rpcError) {
          logStep("Error adding freelancer credits", { error: rpcError });
        } else {
          logStep("Freelancer credits added", { credits: creditsAmount });
        }
      } else if (paymentType === 'company_wallet') {
        const { error: rpcError } = await supabaseAdmin
          .rpc('credit_company_wallet', {
            p_company_user_id: user.id,
            p_amount_cents: amountCents as number,
            p_payment_id: payment.id,
            p_reason: 'wallet_topup_mercadopago_card',
          });

        if (rpcError) {
          logStep("Error crediting company wallet", { error: rpcError });
        } else {
          logStep("Company wallet credited", { amount: amountCents });
        }
      }

      // Send notification
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'payment_success',
          message: paymentType === 'freelancer_credits' 
            ? `Seus ${creditsAmount} créditos de proposta foram adicionados!`
            : `Seus fundos foram adicionados à sua carteira!`,
          link: '/settings?tab=billing',
        });
    }

    return new Response(JSON.stringify({ 
      success: ourStatus === 'paid',
      paymentId: payment.id,
      mpPaymentId: mpPayment.id,
      status: mpPayment.status,
      statusDetail: mpPayment.status_detail,
      paymentMethodId: mpPayment.payment_method_id || null,
      paymentTypeId: mpPayment.payment_type_id || null,
      errorMessage: mpPayment.status === 'rejected' 
        ? (mpPayment.status_detail || 'Pagamento rejeitado') 
        : null,
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
