import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SAFE_CORS_HEADERS, SECURITY_HEADERS, safeLog } from "../_shared/security.ts";

const corsHeaders = SAFE_CORS_HEADERS;

const logStep = (correlationId: string, step: string, details?: unknown) => {
  safeLog(`CREATE-PIX-PAYMENT:${correlationId}`, step, details as Record<string, unknown> | undefined);
};

// Parse monetary input to cents (integer)
// Accepts: number (already in cents), string formatted values like "5", "5,00", "R$ 5,00"
function parseMoneyToCents(input: unknown): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return NaN;
    return Math.round(input); // Assume already in cents if number
  }
  
  if (typeof input !== 'string') return NaN;
  
  let s = input.trim();
  if (!s) return NaN;
  
  // Remove currency symbols and spaces
  s = s.replace(/[^\d.,-]/g, "");
  
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep = "";
  
  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? "." : ",";
  } else if (lastComma !== -1) {
    decimalSep = ",";
  } else if (lastDot !== -1) {
    decimalSep = ".";
  }
  
  if (!decimalSep) {
    // No decimal separator - assume it's already cents or a whole number in major units
    const onlyDigits = s.replace(/[^\d-]/g, "");
    const intVal = parseInt(onlyDigits || "0", 10);
    // If it looks like cents (small number), return as-is
    // If larger number and no decimals, assume major units
    return intVal >= 100 ? intVal : intVal * 100;
  }
  
  const parts = s.split(decimalSep);
  const fracRaw = (parts.pop() ?? "").replace(/\D/g, "");
  const intRaw = parts.join(decimalSep).replace(/[.,]/g, "").replace(/\D/g, "") || "0";
  
  const intPart = parseInt(intRaw, 10);
  const fracPart = parseInt(fracRaw.padEnd(2, "0").slice(0, 2) || "0", 10);
  
  return intPart * 100 + fracPart;
}

// Validation helpers
function isValidAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 100 && value <= 100000000; // 1 to 1,000,000 BRL in cents
}

function isValidPaymentType(value: unknown): value is string {
  const validTypes = ["freelancer_credits", "company_wallet", "contract_funding", "platform_credits", "company_credits", "project_prefund"];
  return typeof value === 'string' && validTypes.includes(value);
}

function isValidUserType(value: unknown): value is string {
  return value === 'company' || value === 'freelancer';
}

// Default fee percent for project_prefund if not provided
const DEFAULT_FEE_PERCENT = 0.15; // 15%

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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      logStep(correlationId, "Auth failed", { error: userError?.message });
      throw new Error("User not authenticated");
    }
    
    const userId = user.id;
    const userEmail = user.email ?? "";
    
    if (!userId || !userEmail) {
      throw new Error("User not authenticated or email not available");
    }
    logStep(correlationId, "User authenticated", { userId });

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    if (typeof body !== 'object' || body === null) {
      throw new Error("Invalid request body");
    }

    const rawBody = body as Record<string, unknown>;
    logStep(correlationId, "Raw input received", { 
      amountCents: rawBody.amountCents,
      amountInput: rawBody.amountInput,
      paymentType: rawBody.paymentType,
      projectId: rawBody.projectId,
      contractId: rawBody.contractId,
    });

    const { 
      paymentType, 
      userType, 
      amountCents: rawAmountCents,
      amountInput,
      creditsAmount,
      description,
      contractId,
      projectId,
      freelancerUserId,
      // Fee info (optional - will use defaults for project_prefund)
      contractAmountCents: rawContractAmountCents,
      feePercent: rawFeePercent,
      feeAmountCents: rawFeeAmountCents,
    } = rawBody;

    // Validate payment type
    if (!isValidPaymentType(paymentType)) {
      logStep(correlationId, "Invalid payment type", { paymentType });
      throw new Error("Invalid payment type");
    }
    if (!isValidUserType(userType)) {
      logStep(correlationId, "Invalid user type", { userType });
      throw new Error("Invalid user type");
    }

    // ========== MONETARY NORMALIZATION (Backend is source of truth) ==========
    let baseAmountCents: number;
    let feePercent: number;
    let feeAmountCents: number;
    let totalAmountCents: number;

    // For project_prefund: recalculate from base amount with default fee
    if (paymentType === 'project_prefund') {
      // Validate projectId is present
      if (typeof projectId !== 'string' || projectId.length < 10) {
        throw new Error("Project ID is required for project prefund");
      }
      
      // Priority: use provided amountCents as total, or calculate from input
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else if (amountInput !== undefined) {
        totalAmountCents = parseMoneyToCents(amountInput);
      } else {
        throw new Error("Amount is required");
      }
      
      // Use provided fee breakdown or calculate with default
      if (typeof rawFeePercent === 'number' && typeof rawFeeAmountCents === 'number') {
        feePercent = rawFeePercent;
        feeAmountCents = Math.round(rawFeeAmountCents);
        // Back-calculate base from total - fee
        baseAmountCents = totalAmountCents - feeAmountCents;
      } else if (typeof rawContractAmountCents === 'number') {
        // Use contract amount as base
        baseAmountCents = Math.round(rawContractAmountCents);
        feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
        feeAmountCents = Math.round(baseAmountCents * feePercent);
        totalAmountCents = baseAmountCents + feeAmountCents;
      } else {
        // Fall back to default: total already includes fee, back-calculate
        feePercent = DEFAULT_FEE_PERCENT;
        baseAmountCents = Math.round(totalAmountCents / (1 + feePercent));
        feeAmountCents = totalAmountCents - baseAmountCents;
      }
    } else if (paymentType === 'contract_funding') {
      // Contract funding - requires contract amount
      if (typeof contractId !== 'string' || contractId.length < 10) {
        throw new Error("Contract ID is required for contract funding");
      }
      if (typeof rawContractAmountCents !== 'number' || rawContractAmountCents < 100) {
        throw new Error("Contract amount is required for contract funding");
      }
      
      baseAmountCents = Math.round(rawContractAmountCents);
      feePercent = typeof rawFeePercent === 'number' ? rawFeePercent : DEFAULT_FEE_PERCENT;
      feeAmountCents = typeof rawFeeAmountCents === 'number' ? Math.round(rawFeeAmountCents) : Math.round(baseAmountCents * feePercent);
      
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else {
        totalAmountCents = baseAmountCents + feeAmountCents;
      }
    } else {
      // Other payment types (credits, wallet)
      if (typeof rawAmountCents === 'number' && rawAmountCents >= 100) {
        totalAmountCents = Math.round(rawAmountCents);
      } else if (amountInput !== undefined) {
        totalAmountCents = parseMoneyToCents(amountInput);
      } else {
        throw new Error("Amount is required");
      }
      baseAmountCents = totalAmountCents;
      feePercent = 0;
      feeAmountCents = 0;
    }

    // Validate final amount
    if (!isValidAmount(totalAmountCents)) {
      logStep(correlationId, "Invalid calculated amount", { 
        totalAmountCents, 
        baseAmountCents, 
        feeAmountCents 
      });
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
    const idempotencyKey = `pix_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record first
    const creditsAmountInt = creditsAmount != null ? Math.floor(Number(creditsAmount)) : null;
    
    const paymentMetadata: Record<string, unknown> = {
      description: description || null,
      user_email: userEmail,
      payment_method: 'pix',
      freelancer_user_id: freelancerUserId || null,
      // Monetary breakdown
      base_amount_cents: baseAmountCents,
      fee_percent: feePercent,
      fee_amount_cents: feeAmountCents,
      // Project prefund tracking
      project_id: projectId || null,
      // Contract funding tracking
      contract_amount_cents: paymentType === 'contract_funding' ? baseAmountCents : null,
    };

    const paymentInsert: Record<string, unknown> = {
      provider: 'mercadopago',
      payment_type: paymentType as string, // CRITICAL: Use exact payment type from request
      user_id: userId,
      user_type: userType as string,
      amount_cents: totalAmountCents, // Total amount charged (including fee)
      currency: 'BRL',
      credits_amount: creditsAmountInt,
      status: 'pending', // ALWAYS pending until webhook confirms
      external_reference: idempotencyKey,
      metadata: paymentMetadata,
    };

    // Add contract_id if contract funding
    if (paymentType === 'contract_funding' && contractId) {
      paymentInsert.contract_id = contractId;
    }

    logStep(correlationId, "Creating payment record", { 
      payment_type: paymentType,
      amount_cents: totalAmountCents,
    });

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

    // Get payer info
    let payerFirstName = "Cliente";
    let payerLastName = "Hookly";
    
    if (userType === 'freelancer') {
      const { data: profile } = await supabaseClient
        .from('freelancer_profiles')
        .select('full_name')
        .eq('user_id', userId)
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
        .eq('user_id', userId)
        .single();
      
      if (profile?.contact_name) {
        const nameParts = profile.contact_name.split(' ');
        payerFirstName = nameParts[0] || "Cliente";
        payerLastName = nameParts.slice(1).join(' ') || "Hookly";
      }
    }

    // CRITICAL: Convert cents to major units for Mercado Pago
    const transactionAmount = Number((totalAmountCents / 100).toFixed(2));
    
    const mpPaymentBody = {
      transaction_amount: transactionAmount,
      description: paymentDescription,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
        first_name: payerFirstName,
        last_name: payerLastName,
      },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      external_reference: payment.id,
    };

    logStep(correlationId, "Creating Mercado Pago PIX payment", { 
      transactionAmount,
      description: paymentDescription,
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

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text();
      logStep(correlationId, "Mercado Pago API error", { 
        status: mpResponse.status, 
        body: errorBody 
      });
      
      // Update payment with error info
      await supabaseAdmin
        .from('unified_payments')
        .update({
          status: 'failed',
          metadata: {
            ...paymentMetadata,
            provider_error: {
              provider: 'mercadopago',
              status: mpResponse.status,
              body: errorBody,
            },
          },
        })
        .eq('id', payment.id);
      
      return new Response(JSON.stringify({ 
        error: "Payment provider error",
        code: "PAYMENT_PROVIDER_ERROR",
        provider: "mercadopago",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const mpPayment = await mpResponse.json();
    logStep(correlationId, "Mercado Pago payment created", { 
      mpPaymentId: mpPayment.id, 
      status: mpPayment.status,
      transactionAmount: mpPayment.transaction_amount,
    });

    // Extract PIX data
    const pixData = mpPayment.point_of_interaction?.transaction_data;
    
    if (!pixData?.qr_code || !pixData?.qr_code_base64) {
      logStep(correlationId, "PIX data not available", { pixData });
      throw new Error("PIX QR Code not generated");
    }

    // Calculate expiration (PIX usually expires in 30 minutes)
    const expiresAt = mpPayment.date_of_expiration || 
      new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Update payment with Mercado Pago info
    // CRITICAL: status stays 'pending' until webhook confirms
    await supabaseAdmin
      .from('unified_payments')
      .update({
        provider_payment_id: String(mpPayment.id),
        status: 'pending', // Always pending until webhook
        metadata: {
          ...paymentMetadata,
          pix_qr_code: pixData.qr_code,
          pix_expires_at: expiresAt,
          mp_status: mpPayment.status,
          mp_status_detail: mpPayment.status_detail,
        },
      })
      .eq('id', payment.id);

    logStep(correlationId, "Payment updated with PIX data", {
      paymentId: payment.id,
      mpPaymentId: mpPayment.id,
      totalAmountCents,
      transactionAmount,
    });

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
      // Return breakdown for UI display
      amount: transactionAmount,
      amountCents: totalAmountCents,
      baseAmountCents,
      feeAmountCents,
      feePercent,
      currency: 'BRL',
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
