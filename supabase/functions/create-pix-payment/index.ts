import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PIX-PAYMENT] ${step}${detailsStr}`);
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
  const validTypes = ["freelancer_credits", "company_wallet", "contract_funding", "platform_credits", "company_credits", "project_prefund"];
  return typeof value === 'string' && validTypes.includes(value);
}

function isValidUserType(value: unknown): value is string {
  return value === 'company' || value === 'freelancer';
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
      paymentType, 
      userType, 
      amountCents, 
      creditsAmount,
      description,
      contractId,
      projectId,
      freelancerUserId,
      // Contract funding fee info
      contractAmountCents,
      feePercent,
      feeAmountCents,
    } = body as Record<string, unknown>;

    // Validate required fields
    if (!isValidPaymentType(paymentType)) {
      logStep("Invalid payment type", { paymentType });
      throw new Error("Invalid payment type");
    }
    if (!isValidUserType(userType)) {
      logStep("Invalid user type", { userType });
      throw new Error("Invalid user type");
    }
    if (!isValidAmount(amountCents)) {
      logStep("Invalid amount", { amountCents, type: typeof amountCents });
      throw new Error("Amount must be between R$1 and R$1,000,000");
    }

    // Validate contract ID if contract_funding
    if (paymentType === 'contract_funding') {
      if (typeof contractId !== 'string' || contractId.length < 10) {
        throw new Error("Contract ID is required for contract funding");
      }
      // contractAmountCents is the actual contract value (excluding fee)
      if (typeof contractAmountCents !== 'number' || contractAmountCents < 100) {
        throw new Error("Contract amount is required for contract funding");
      }
    }
    
    // Validate projectId if project_prefund
    if (paymentType === 'project_prefund') {
      if (typeof projectId !== 'string' || projectId.length < 10) {
        throw new Error("Project ID is required for project prefund");
      }
    }

    logStep("Request validated", { 
      paymentType, 
      userType, 
      amountCents, 
      contractAmountCents,
      feePercent,
      feeAmountCents,
      creditsAmount 
    });

    // Get Mercado Pago access token
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago not configured");
    }

    // Generate unique idempotency key
    const idempotencyKey = `pix_${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record first
    // Ensure credits_amount is an integer (round down any decimals from bonuses)
    const creditsAmountInt = creditsAmount != null ? Math.floor(Number(creditsAmount)) : null;
    
    const paymentInsert: Record<string, unknown> = {
      provider: 'mercadopago',
      payment_type: paymentType as string,
      user_id: user.id,
      user_type: userType as string,
      amount_cents: amountCents as number, // Total amount charged (including fee)
      currency: 'BRL',
      credits_amount: creditsAmountInt,
      status: 'pending',
      external_reference: idempotencyKey,
      metadata: {
        description: description || null,
        user_email: user.email,
        payment_method: 'pix',
        freelancer_user_id: freelancerUserId || null,
        // Fee tracking for contract funding
        contract_amount_cents: contractAmountCents || null,
        fee_percent: feePercent || null,
        fee_amount_cents: feeAmountCents || null,
        // Project prefund tracking
        project_id: projectId || null,
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

    // Create PIX payment via Mercado Pago API
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

    // Get payer info (CPF is required for PIX)
    let payerFirstName = "Cliente";
    let payerLastName = "Hookly";
    
    if (userType === 'freelancer') {
      const { data: profile } = await supabaseClient
        .from('freelancer_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.full_name) {
        const nameParts = profile.full_name.split(' ');
        payerFirstName = nameParts[0] || "Cliente";
        payerLastName = nameParts.slice(1).join(' ') || "Hookly";
      }
    } else {
      const { data: profile } = await supabaseClient
        .from('company_profiles')
        .select('contact_name')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.contact_name) {
        const nameParts = profile.contact_name.split(' ');
        payerFirstName = nameParts[0] || "Cliente";
        payerLastName = nameParts.slice(1).join(' ') || "Hookly";
      }
    }

    const mpPaymentBody = {
      transaction_amount: (amountCents as number) / 100,
      description: paymentDescription,
      payment_method_id: "pix",
      payer: {
        email: user.email,
        first_name: payerFirstName,
        last_name: payerLastName,
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      external_reference: payment.id,
    };

    logStep("Creating Mercado Pago PIX payment", { 
      amount: mpPaymentBody.transaction_amount,
      description: paymentDescription 
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

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text();
      logStep("Mercado Pago API error", { status: mpResponse.status, body: errorBody });
      
      // Clean up the payment record
      await supabaseAdmin.from('unified_payments').delete().eq('id', payment.id);
      
      throw new Error(`Mercado Pago API error: ${mpResponse.status} - ${errorBody}`);
    }

    const mpPayment = await mpResponse.json();
    logStep("Mercado Pago payment created", { 
      mpPaymentId: mpPayment.id, 
      status: mpPayment.status 
    });

    // Extract PIX data
    const pixData = mpPayment.point_of_interaction?.transaction_data;
    
    if (!pixData?.qr_code || !pixData?.qr_code_base64) {
      logStep("PIX data not available", { pixData });
      throw new Error("PIX QR Code not generated");
    }

    // Calculate expiration (PIX usually expires in 30 minutes)
    const expiresAt = mpPayment.date_of_expiration || 
      new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Update payment with Mercado Pago info
    await supabaseAdmin
      .from('unified_payments')
      .update({
        provider_payment_id: String(mpPayment.id),
        status: mpPayment.status === 'approved' ? 'paid' : 'pending',
        metadata: {
          description: description || null,
          user_email: user.email,
          payment_method: 'pix',
          pix_qr_code: pixData.qr_code,
          pix_expires_at: expiresAt,
          mp_status: mpPayment.status,
          mp_status_detail: mpPayment.status_detail,
        },
      })
      .eq('id', payment.id);

    logStep("Payment updated with PIX data");

    return new Response(JSON.stringify({ 
      success: true,
      paymentId: payment.id,
      mpPaymentId: mpPayment.id,
      status: mpPayment.status,
      pix: {
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64,
        expiresAt: expiresAt,
        ticketUrl: pixData.ticket_url,
      },
      amount: (amountCents as number) / 100,
      currency: 'BRL',
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
