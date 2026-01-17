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

// ============ Currency Conversion Logic (inline) ============

const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2, BRL: 2, EUR: 2, GBP: 2, CAD: 2, AUD: 2, 
  MXN: 2, ARS: 2, CLP: 0, COP: 2, PEN: 2, CHF: 2, INR: 2,
  JPY: 0, KRW: 0, VND: 0, CNY: 2,
  KWD: 3, BHD: 3, OMR: 3,
};

const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1.0, BRL: 0.17, EUR: 1.08, GBP: 1.26, CAD: 0.74, AUD: 0.65,
  MXN: 0.056, JPY: 0.0067, CNY: 0.14, INR: 0.012, CHF: 1.13,
  ARS: 0.001, CLP: 0.001, COP: 0.00025, PEN: 0.27,
};

function getMinorUnitDivisor(currency: string): number {
  return Math.pow(10, CURRENCY_DECIMALS[currency] ?? 2);
}

type FxRateSource = 'live' | 'cached' | 'fallback';

interface FxResult {
  amount_usd_minor: number;
  fx_rate_market: number;
  fx_rate_applied: number;
  fx_spread_percent: number;
  fx_spread_amount_usd_minor: number;
  fx_provider: string;
  fx_timestamp: string;
  fx_rate_source: FxRateSource;
}

async function convertToUSD(amountMinor: number, currency: string, spreadPercent = 0.008): Promise<FxResult> {
  const timestamp = new Date().toISOString();
  
  if (currency === 'USD') {
    return {
      amount_usd_minor: amountMinor,
      fx_rate_market: 1.0,
      fx_rate_applied: 1.0,
      fx_spread_percent: 0,
      fx_spread_amount_usd_minor: 0,
      fx_provider: 'none',
      fx_timestamp: timestamp,
      fx_rate_source: 'live',
    };
  }

  const divisor = getMinorUnitDivisor(currency);
  const amountMajor = amountMinor / divisor;

  // Try to fetch real rate
  let marketRate: number | null = null;
  let provider = 'exchangerate-api.com';
  let rateSource: FxRateSource = 'live';
  
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    if (response.ok) {
      const data = await response.json();
      if (data.rates?.USD) {
        marketRate = data.rates.USD;
        rateSource = 'live';
      }
    }
  } catch (error) {
    logStep("Exchange rate API error, using fallback", { error: String(error) });
  }

  if (marketRate === null) {
    marketRate = FALLBACK_RATES_TO_USD[currency] ?? 0.17;
    provider = 'fallback';
    rateSource = 'fallback';
    logStep("Using fallback rate", { currency, marketRate, rateSource });
  }

  const appliedRate = marketRate * (1 - spreadPercent);
  const amountUsdMajor = amountMajor * appliedRate;
  const amountUsdMajorWithoutSpread = amountMajor * marketRate;
  const spreadAmountUsdMajor = amountUsdMajorWithoutSpread - amountUsdMajor;

  return {
    amount_usd_minor: Math.round(amountUsdMajor * 100),
    fx_rate_market: marketRate,
    fx_rate_applied: appliedRate,
    fx_spread_percent: spreadPercent,
    fx_spread_amount_usd_minor: Math.round(spreadAmountUsdMajor * 100),
    fx_provider: provider,
    fx_timestamp: timestamp,
    fx_rate_source: rateSource,
  };
}

function extractPaymentMethod(paymentData: Record<string, unknown>): string {
  const paymentTypeId = paymentData.payment_type_id as string;
  const paymentMethodId = paymentData.payment_method_id as string;
  
  if (paymentTypeId === 'pix' || paymentMethodId?.toLowerCase().includes('pix')) return 'pix';
  if (paymentTypeId === 'credit_card') return 'credit_card';
  if (paymentTypeId === 'debit_card') return 'debit_card';
  if (paymentTypeId === 'bank_transfer') return 'bank_transfer';
  if (paymentTypeId === 'ticket' || paymentMethodId?.toLowerCase().includes('boleto')) return 'boleto';
  return paymentTypeId || 'unknown';
}

// ============ End Currency Conversion ============

function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function mapMPStatus(mpStatus: string): string {
  switch (mpStatus) {
    case "approved": return "paid";
    case "pending":
    case "in_process":
    case "authorized": return "pending";
    case "rejected":
    case "cancelled": return "failed";
    case "refunded":
    case "charged_back": return "refunded";
    default: return "pending";
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

    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const id = url.searchParams.get("id") || url.searchParams.get("data.id");

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Body might be empty
    }

    const notificationType = topic || body.type || body.topic;
    const bodyData = body.data as Record<string, unknown> | undefined;
    const resourceId = id || bodyData?.id || body.id;

    logStep("Notification parsed", { type: notificationType, resourceId });

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

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("Mercado Pago not configured");
    }

    // Fetch payment details from Mercado Pago API
    let paymentData: Record<string, unknown>;
    
    if (notificationType === "payment") {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        logStep("Failed to fetch payment from MP", { status: response.status });
        throw new Error(`Failed to fetch payment: ${response.status}`);
      }

      paymentData = await response.json();
    } else {
      // merchant_order
      const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${resourceId}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
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

      const latestPayment = payments[payments.length - 1];
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${latestPayment.id}`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });

      if (!paymentResponse.ok) {
        throw new Error(`Failed to fetch payment: ${paymentResponse.status}`);
      }

      paymentData = await paymentResponse.json();
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

    // Extract payment method from MP payload
    const paymentMethod = extractPaymentMethod(paymentData);

    if (!externalReference) {
      logStep("No external reference found, skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Find our payment record
    let payment;
    
    const { data: paymentByRef } = await supabaseAdmin
      .from('unified_payments')
      .select('*')
      .eq('external_reference', externalReference)
      .maybeSingle();

    if (paymentByRef) {
      payment = paymentByRef;
    } else if (isValidUUID(externalReference)) {
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

    const newStatus = mapMPStatus(mpStatus);

    // Check idempotency
    if (payment.status === 'paid' && newStatus === 'paid') {
      logStep("Payment already processed", { paymentId: payment.id });
      return new Response(JSON.stringify({ received: true, already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Convert to USD with spread
    const transactionAmountMinor = Math.round(transactionAmount * getMinorUnitDivisor(currencyId));
    const fxResult = await convertToUSD(transactionAmountMinor, currencyId);

    logStep("Currency conversion", { 
      originalAmount: transactionAmountMinor,
      originalCurrency: currencyId,
      usdAmount: fxResult.amount_usd_minor,
      rate: fxResult.fx_rate_applied,
      spread: fxResult.fx_spread_amount_usd_minor,
    });

    // Update payment record with FX data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      provider_payment_id: mpPaymentId,
      updated_at: new Date().toISOString(),
      // New FX fields
      payment_currency: currencyId,
      payment_amount_minor: transactionAmountMinor,
      payment_method: paymentMethod,
      gateway_provider: 'mercadopago',
      amount_usd_minor: fxResult.amount_usd_minor,
      fx_rate_market: fxResult.fx_rate_market,
      fx_rate_applied: fxResult.fx_rate_applied,
      fx_spread_percent: fxResult.fx_spread_percent,
      fx_spread_amount_usd_minor: fxResult.fx_spread_amount_usd_minor,
      fx_provider: fxResult.fx_provider,
      fx_timestamp: fxResult.fx_timestamp,
      fx_rate_source: fxResult.fx_rate_source,
    };

    if (newStatus === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('unified_payments')
      .update(updateData)
      .eq('id', payment.id);

    logStep("Payment status updated with FX data", { paymentId: payment.id, newStatus });

    // If payment is approved, execute financial effects using USD amounts
    if (newStatus === 'paid') {
      const paymentType = payment.payment_type;
      const userId = payment.user_id;
      const creditsAmount = payment.credits_amount;

      // Use USD amount for internal ledger
      const amountUsdUnits = fxResult.amount_usd_minor / 100;

      if (paymentType === 'freelancer_credits') {
        logStep("Adding credits via new ledger system", { userId, amount: amountUsdUnits, creditsAmount });
        
        const { data: result, error: rpcError } = await supabaseAdmin
          .rpc('add_credits', {
            p_user_id: userId,
            p_user_type: 'freelancer',
            p_amount: creditsAmount || amountUsdUnits,
            p_payment_id: payment.id,
            p_context: 'credits_purchase_mercadopago',
            p_amount_original: transactionAmount,
            p_currency_original: currencyId,
          });

        if (rpcError) {
          logStep("Error adding credits via ledger", { error: rpcError });
          
          const { error: fallbackError } = await supabaseAdmin
            .rpc('add_freelancer_credits', {
              p_freelancer_user_id: userId,
              p_credits: creditsAmount || Math.floor(amountUsdUnits),
              p_payment_id: payment.id,
              p_reason: 'credits_purchase_mercadopago',
            });
          
          if (fallbackError) {
            logStep("Fallback also failed", { error: fallbackError });
          } else {
            logStep("Credits added via fallback", { userId, credits: creditsAmount });
          }
        } else {
          logStep("Credits added via new ledger", { userId, amount: amountUsdUnits, result });
        }

      } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
        logStep("Adding company credits via new ledger", { userId, amount: amountUsdUnits });
        
        const { data: result, error: rpcError } = await supabaseAdmin
          .rpc('add_credits', {
            p_user_id: userId,
            p_user_type: 'company',
            p_amount: amountUsdUnits,
            p_payment_id: payment.id,
            p_context: 'wallet_topup_mercadopago',
            p_amount_original: transactionAmount,
            p_currency_original: currencyId,
          });

        if (rpcError) {
          logStep("Error adding company credits via ledger", { error: rpcError });
          
          const { error: fallbackError } = await supabaseAdmin
            .rpc('credit_company_wallet', {
              p_company_user_id: userId,
              p_amount_cents: fxResult.amount_usd_minor,
              p_payment_id: payment.id,
              p_reason: 'wallet_topup_mercadopago',
            });
          
          if (fallbackError) {
            logStep("Fallback also failed", { error: fallbackError });
          } else {
            logStep("Company wallet credited via fallback", { userId, amount: fxResult.amount_usd_minor });
          }
        } else {
          logStep("Company credits added via new ledger", { userId, amount: amountUsdUnits, result });
        }

      } else if (paymentType === 'platform_credits') {
        // Platform credits - separate system, no FX fees, direct credit amount
        logStep("Adding platform credits", { userId, amount: creditsAmount });
        
        const { data: result, error: rpcError } = await supabaseAdmin
          .rpc('add_platform_credits', {
            p_user_id: userId,
            p_user_type: 'company',
            p_amount: creditsAmount || Math.floor(amountUsdUnits),
            p_payment_id: payment.id,
            p_description: 'Compra de créditos da plataforma via Mercado Pago',
          });

        if (rpcError) {
          logStep("Error adding platform credits", { error: rpcError });
        } else {
          logStep("Platform credits added", { userId, amount: creditsAmount || Math.floor(amountUsdUnits), result });
        }

      } else if (paymentType === 'contract_funding') {
        const contractId = payment.contract_id;
        const metadata = payment.metadata as Record<string, unknown> | null;
        
        if (contractId) {
          // Use contract_amount_cents from metadata if available (excludes fee)
          // Otherwise fall back to full amount (legacy behavior)
          const contractAmountCents = metadata?.contract_amount_cents as number | undefined;
          const feeAmountCents = metadata?.fee_amount_cents as number | undefined;
          
          // Convert contract amount to USD (not the total paid which includes fee)
          let escrowAmountUsd: number;
          if (contractAmountCents && contractAmountCents > 0) {
            // Convert contract amount (without fee) to USD
            const contractFxResult = await convertToUSD(contractAmountCents, currencyId);
            escrowAmountUsd = contractFxResult.amount_usd_minor / 100;
            logStep("Using contract amount for escrow (excluding fee)", { 
              contractAmountCents, 
              feeAmountCents,
              escrowAmountUsd,
              totalPaidUsd: amountUsdUnits,
            });
          } else {
            // Legacy: use full amount
            escrowAmountUsd = amountUsdUnits;
            logStep("Using full amount for escrow (legacy)", { escrowAmountUsd });
          }
          
          logStep("Funding contract escrow via new ledger", { userId, contractId, amount: escrowAmountUsd });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('fund_contract_escrow', {
              p_company_user_id: userId,
              p_contract_id: contractId,
              p_amount: escrowAmountUsd,
              p_payment_id: payment.id,
            });

          if (rpcError) {
            logStep("Error funding contract escrow", { error: rpcError });
          } else {
            logStep("Contract escrow funded", { userId, contractId, amount: escrowAmountUsd, result });
          }
        } else {
          logStep("No contract_id for contract_funding payment", { paymentId: payment.id });
        }
      }

      // Also record FX data in ledger_transactions
      await supabaseAdmin
        .from('ledger_transactions')
        .update({
          payment_currency: currencyId,
          payment_amount_minor: transactionAmountMinor,
          payment_method: paymentMethod,
          gateway_provider: 'mercadopago',
          amount_usd_minor: fxResult.amount_usd_minor,
          fx_rate_market: fxResult.fx_rate_market,
          fx_rate_applied: fxResult.fx_rate_applied,
          fx_spread_percent: fxResult.fx_spread_percent,
          fx_spread_amount_usd_minor: fxResult.fx_spread_amount_usd_minor,
          fx_provider: fxResult.fx_provider,
          fx_timestamp: fxResult.fx_timestamp,
          fx_rate_source: fxResult.fx_rate_source,
        })
        .eq('related_payment_id', payment.id);

      // Send notification
      let notificationMessage = '';
      if (paymentType === 'freelancer_credits') {
        notificationMessage = `Seus ${creditsAmount || Math.floor(amountUsdUnits)} créditos de proposta foram adicionados!`;
      } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
        notificationMessage = `USD ${amountUsdUnits.toFixed(2)} foram adicionados aos seus créditos! (${currencyId} ${transactionAmount.toFixed(2)})`;
      } else if (paymentType === 'contract_funding') {
        notificationMessage = `Pagamento de USD ${amountUsdUnits.toFixed(2)} foi depositado em garantia!`;
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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});