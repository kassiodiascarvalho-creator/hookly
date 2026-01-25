import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (correlationId: string, step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CARD-PAYMENT][${correlationId}] ${step}${detailsStr}`);
};

// Validation helpers
function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 100 && value <= 100000000;
}

function isValidPaymentType(value: unknown): value is string {
  const validTypes = ["freelancer_credits", "company_wallet", "contract_funding", "platform_credits", "company_credits", "project_prefund"];
  return typeof value === 'string' && validTypes.includes(value);
}

function isValidUserType(value: unknown): value is string {
  return value === 'company' || value === 'freelancer';
}

function isValidString(value: unknown, minLength = 1, maxLength = 500): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

// Default fee percent
const DEFAULT_FEE_PERCENT = 0.15;

serve(async (req) => {
  const correlationId = crypto.randomUUID().slice(0, 8);
  
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
    logStep(correlationId, "Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      logStep(correlationId, "Auth failed", { error: claimsError?.message });
      throw new Error("User not authenticated");
    }
    
    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;
    
    if (!userId || !userEmail) {
      throw new Error("User not authenticated or email not available");
    }
    logStep(correlationId, "User authenticated", { userId });

    // Parse and validate request body
    const rawBody = await req.json();
    
    logStep(correlationId, "Raw input received", {
      amountCents: rawBody.amountCents,
      transactionAmount: rawBody.transactionAmount,
      paymentType: rawBody.paymentType,
      projectId: rawBody.projectId,
      contractId: rawBody.contractId,
    });

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
      amountCents: rawAmountCents, 
      creditsAmount,
      description,
      contractId,
      projectId,
      freelancerUserId,
      // Fee info
      contractAmountCents: rawContractAmountCents,
      feePercent: rawFeePercent,
      feeAmountCents: rawFeeAmountCents,
    } = rawBody;

    // Validate required fields
    if (!isValidString(cardToken, 10, 500)) {
      throw new Error("Invalid card token");
    }
    if (!isValidPaymentType(paymentType)) {
      logStep(correlationId, "Invalid payment type", { paymentType });
      throw new Error("Invalid payment type");
    }
    if (!isValidUserType(userType)) {
      throw new Error("Invalid user type");
    }

    // ========== MONETARY NORMALIZATION (Backend is source of truth) ==========
    let baseAmountCents: number;
    let feePercent: number;
    let feeAmountCents: number;
    let totalAmountCents: number;

    if (paymentType === 'project_prefund') {
      // Validate projectId is present
      if (typeof projectId !== 'string' || projectId.length < 10) {
        throw new Error("Project ID is required for project prefund");
      }
      
      // Get total from input
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else {
        throw new Error("Amount is required");
      }
      
      // Use provided fee breakdown or calculate
      if (typeof rawFeePercent === 'number' && typeof rawFeeAmountCents === 'number') {
        feePercent = rawFeePercent;
        feeAmountCents = Math.round(rawFeeAmountCents);
        baseAmountCents = totalAmountCents - feeAmountCents;
      } else if (typeof rawContractAmountCents === 'number') {
        baseAmountCents = Math.round(rawContractAmountCents);
        feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
        feeAmountCents = Math.round(baseAmountCents * feePercent);
        totalAmountCents = baseAmountCents + feeAmountCents;
      } else {
        feePercent = DEFAULT_FEE_PERCENT;
        baseAmountCents = Math.round(totalAmountCents / (1 + feePercent));
        feeAmountCents = totalAmountCents - baseAmountCents;
      }
      
    } else if (paymentType === 'contract_funding') {
      if (typeof contractId !== 'string' || contractId.length < 10) {
        throw new Error("Contract ID is required for contract funding");
      }
      
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else {
        throw new Error("Amount is required");
      }
      
      if (typeof rawContractAmountCents === 'number') {
        baseAmountCents = Math.round(rawContractAmountCents);
        feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
        feeAmountCents = typeof rawFeeAmountCents === 'number' ? Math.round(rawFeeAmountCents) : Math.round(baseAmountCents * feePercent);
      } else {
        feePercent = DEFAULT_FEE_PERCENT;
        baseAmountCents = Math.round(totalAmountCents / (1 + feePercent));
        feeAmountCents = totalAmountCents - baseAmountCents;
      }
      
    } else {
      // Other payment types (credits, wallet)
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else {
        throw new Error("Amount is required");
      }
      baseAmountCents = totalAmountCents;
      feePercent = 0;
      feeAmountCents = 0;
    }

    // Validate final amount
    if (!isValidAmount(totalAmountCents)) {
      logStep(correlationId, "Invalid amount", { totalAmountCents });
      throw new Error(`Amount must be between R$1 and R$1,000,000 (got ${totalAmountCents} cents)`);
    }

    logStep(correlationId, "Monetary values calculated", { 
      baseAmountCents,
      feePercent,
      feeAmountCents,
      totalAmountCents,
      transactionAmountMajor: totalAmountCents / 100,
    });

    // Get Mercado Pago access token
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago not configured");
    }

    // Generate unique idempotency key
    const idempotencyKey = `card_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment metadata
    const paymentMetadata: Record<string, unknown> = {
      description: description || null,
      user_email: userEmail,
      payment_method: 'card',
      freelancer_user_id: freelancerUserId || null,
      // Monetary breakdown
      base_amount_cents: baseAmountCents,
      fee_percent: feePercent,
      fee_amount_cents: feeAmountCents,
      // Context
      project_id: projectId || null,
      contract_amount_cents: paymentType === 'contract_funding' ? baseAmountCents : null,
    };

    // Create payment record first
    const paymentInsert: Record<string, unknown> = {
      provider: 'mercadopago',
      payment_type: paymentType as string, // CRITICAL: Use exact payment type
      user_id: userId,
      user_type: userType as string,
      amount_cents: totalAmountCents,
      currency: 'BRL',
      credits_amount: (creditsAmount as number) || null,
      status: 'pending',
      external_reference: idempotencyKey,
      metadata: paymentMetadata,
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
      logStep(correlationId, "Failed to create payment record", { 
        error: paymentError,
        code: paymentError?.code,
        message: paymentError?.message,
      });
      throw new Error(`Failed to create payment record: ${paymentError?.message || 'Unknown error'}`);
    }

    logStep(correlationId, "Payment record created", { paymentId: payment.id });

    // Create card payment via Mercado Pago API
    const paymentDescription = paymentType === 'freelancer_credits' 
      ? `${creditsAmount} Créditos de Proposta - Hookly`
      : paymentType === 'company_wallet'
      ? `Fundos na Carteira - Hookly`
      : paymentType === 'contract_funding'
      ? String(description) || "Financiamento de Contrato - Hookly"
      : paymentType === 'project_prefund'
      ? "Pré-financiamento de Projeto - Hookly"
      : (paymentType === 'platform_credits' || paymentType === 'company_credits')
      ? `${creditsAmount} Créditos da Plataforma - Hookly`
      : String(description) || "Pagamento Hookly";

    // CRITICAL: Convert cents to major units for Mercado Pago
    // Use transactionAmount from Brick if available, otherwise calculate from cents
    const mpTransactionAmount = typeof transactionAmount === 'number' && transactionAmount > 0
      ? transactionAmount
      : Number((totalAmountCents / 100).toFixed(2));

    const mpPaymentBody: Record<string, unknown> = {
      transaction_amount: mpTransactionAmount,
      token: cardToken,
      description: paymentDescription,
      installments: Number(installments) || 1,
      payment_method_id: paymentMethodId || undefined,
      issuer_id: issuerId ? Number(issuerId) : undefined,
      payer: {
        email: payerEmail || userEmail,
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

    logStep(correlationId, "Creating Mercado Pago card payment", { 
      transactionAmount: mpPaymentBody.transaction_amount,
      installments: mpPaymentBody.installments,
      paymentId: payment.id,
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
      logStep(correlationId, "Mercado Pago API error", { 
        status: mpResponse.status, 
        error: mpPayment 
      });
      
      // Update payment record with error
      await supabaseAdmin
        .from('unified_payments')
        .update({
          status: 'failed',
          metadata: {
            ...paymentMetadata,
            provider_error: {
              provider: 'mercadopago',
              status: mpResponse.status,
              message: mpPayment.message,
              cause: mpPayment.cause,
            },
          },
        })
        .eq('id', payment.id);
      
      return new Response(JSON.stringify({ 
        error: mpPayment.message || `Mercado Pago API error: ${mpResponse.status}`,
        code: "PAYMENT_PROVIDER_ERROR",
        provider: "mercadopago",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep(correlationId, "Mercado Pago payment created", { 
      mpPaymentId: mpPayment.id, 
      status: mpPayment.status,
      statusDetail: mpPayment.status_detail,
      transactionAmount: mpPayment.transaction_amount,
    });

    // Map MP status to our status
    // CRITICAL: Only mark as 'paid' if truly approved, otherwise keep 'pending'
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
        ...paymentMetadata,
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

    logStep(correlationId, "Payment record updated", { status: ourStatus });

    // If payment is approved, execute financial effects immediately
    if (ourStatus === 'paid') {
      if (paymentType === 'freelancer_credits' && creditsAmount) {
        const { error: rpcError } = await supabaseAdmin
          .rpc('add_freelancer_credits', {
            p_freelancer_user_id: userId,
            p_credits: creditsAmount as number,
            p_payment_id: payment.id,
            p_reason: 'credits_purchase_mercadopago_card',
          });

        if (rpcError) {
          logStep(correlationId, "Error adding freelancer credits", { error: rpcError });
        } else {
          logStep(correlationId, "Freelancer credits added", { credits: creditsAmount });
        }
      } else if (paymentType === 'company_wallet') {
        const { error: rpcError } = await supabaseAdmin
          .rpc('credit_company_wallet', {
            p_company_user_id: userId,
            p_amount_cents: totalAmountCents,
            p_payment_id: payment.id,
            p_reason: 'wallet_topup_mercadopago_card',
          });

        if (rpcError) {
          logStep(correlationId, "Error crediting company wallet", { error: rpcError });
        } else {
          logStep(correlationId, "Company wallet credited", { amount: totalAmountCents });
        }
      } else if ((paymentType === 'platform_credits' || paymentType === 'company_credits') && creditsAmount) {
        const { error: rpcError } = await supabaseAdmin
          .rpc('add_platform_credits', {
            p_user_id: userId,
            p_user_type: userType as string,
            p_amount: creditsAmount as number,
            p_payment_id: payment.id,
            p_description: 'Recarga via Cartão MP',
          });

        if (rpcError) {
          logStep(correlationId, "Error adding platform credits", { error: rpcError });
        } else {
          logStep(correlationId, "Platform credits added", { credits: creditsAmount });
        }
      }
      // Note: project_prefund fulfillment is handled by webhooks/RPCs

      // Send notification
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'payment_success',
          message: paymentType === 'freelancer_credits' 
            ? `Seus ${creditsAmount} créditos de proposta foram adicionados!`
            : paymentType === 'project_prefund'
            ? 'Seu pré-financiamento foi confirmado!'
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
      // Return breakdown for UI
      amountCents: totalAmountCents,
      baseAmountCents,
      feeAmountCents,
      feePercent,
      errorMessage: mpPayment.status === 'rejected' 
        ? (mpPayment.status_detail || 'Pagamento rejeitado') 
        : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep(correlationId, "ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
