import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UNIFIED-WEBHOOK] ${step}${detailsStr}`);
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

  let marketRate: number | null = null;
  let provider = 'exchangerate-api.com';
  let rateSource: FxRateSource = 'live';
  
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${currency}`, {
      signal: AbortSignal.timeout(5000),
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
    marketRate = FALLBACK_RATES_TO_USD[currency] ?? 1.0;
    provider = 'fallback';
    rateSource = 'fallback';
    logStep("Using fallback rate", { currency, marketRate });
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

// ============ End Currency Conversion ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    logStep("Webhook received");

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};

      logStep("Checkout session completed", { sessionId: session.id, metadata });

      if (metadata.type === "unified_payment" && metadata.payment_id) {
        const paymentId = metadata.payment_id;
        const paymentType = metadata.payment_type;
        const creditsAmount = parseInt(metadata.credits_amount || "0", 10);
        const currency = session.currency?.toUpperCase() || "USD";
        const amountTotal = session.amount_total || 0;

        const { data: payment, error: findError } = await supabaseAdmin
          .from('unified_payments')
          .select('*')
          .eq('id', paymentId)
          .maybeSingle();

        if (findError || !payment) {
          logStep("Payment not found", { paymentId, error: findError });
          return new Response(JSON.stringify({ error: "Payment not found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404,
          });
        }

        if (payment.status === 'paid') {
          logStep("Payment already processed", { paymentId });
          return new Response(JSON.stringify({ received: true, already_processed: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }

        // Convert to USD with spread
        const fxResult = await convertToUSD(amountTotal, currency);

        logStep("Currency conversion", { 
          originalAmount: amountTotal,
          originalCurrency: currency,
          usdAmount: fxResult.amount_usd_minor,
          rate: fxResult.fx_rate_applied,
        });

        // Update payment status with FX data
        await supabaseAdmin
          .from('unified_payments')
          .update({
            status: 'paid',
            provider_payment_id: session.payment_intent as string,
            provider_checkout_id: session.id,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // FX fields
            payment_currency: currency,
            payment_amount_minor: amountTotal,
            payment_method: 'card',
            gateway_provider: 'stripe',
            amount_usd_minor: fxResult.amount_usd_minor,
            fx_rate_market: fxResult.fx_rate_market,
            fx_rate_applied: fxResult.fx_rate_applied,
            fx_spread_percent: fxResult.fx_spread_percent,
            fx_spread_amount_usd_minor: fxResult.fx_spread_amount_usd_minor,
            fx_provider: fxResult.fx_provider,
            fx_timestamp: fxResult.fx_timestamp,
            fx_rate_source: fxResult.fx_rate_source,
          })
          .eq('id', paymentId);

        logStep("Payment status updated to paid with FX data", { paymentId });

        const userId = payment.user_id;
        const amountUsdUnits = fxResult.amount_usd_minor / 100;

        if (paymentType === 'freelancer_credits') {
          logStep("Adding freelancer credits via new ledger", { userId, amount: amountUsdUnits, creditsAmount });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('add_credits', {
              p_user_id: userId,
              p_user_type: 'freelancer',
              p_amount: creditsAmount > 0 ? creditsAmount : amountUsdUnits,
              p_payment_id: paymentId,
              p_context: 'credits_purchase_stripe',
              p_amount_original: amountTotal / 100,
              p_currency_original: currency,
            });

          if (rpcError) {
            logStep("Error adding credits via new ledger", { error: rpcError });
            
            const { error: fallbackError } = await supabaseAdmin
              .rpc('add_freelancer_credits', {
                p_freelancer_user_id: userId,
                p_credits: creditsAmount > 0 ? creditsAmount : Math.floor(amountUsdUnits),
                p_payment_id: paymentId,
                p_reason: 'credits_purchase_stripe',
              });
            
            if (fallbackError) {
              logStep("Fallback also failed", { error: fallbackError });
            } else {
              logStep("Credits added via fallback", { userId, credits: creditsAmount });
            }
          } else {
            logStep("Freelancer credits added via new ledger", { userId, amount: creditsAmount || amountUsdUnits, result });
          }

        } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
          logStep("Adding company credits via new ledger", { userId, amount: amountUsdUnits });
          
          const { data: result, error: rpcError } = await supabaseAdmin
            .rpc('add_credits', {
              p_user_id: userId,
              p_user_type: 'company',
              p_amount: amountUsdUnits,
              p_payment_id: paymentId,
              p_context: 'wallet_topup_stripe',
              p_amount_original: amountTotal / 100,
              p_currency_original: currency,
            });

          if (rpcError) {
            logStep("Error adding company credits via new ledger", { error: rpcError });
            
            const { error: fallbackError } = await supabaseAdmin
              .rpc('credit_company_wallet', {
                p_company_user_id: userId,
                p_amount_cents: fxResult.amount_usd_minor,
                p_payment_id: paymentId,
                p_reason: 'wallet_topup_stripe',
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
              p_amount: creditsAmount > 0 ? creditsAmount : Math.floor(amountUsdUnits),
              p_payment_id: paymentId,
              p_description: 'Compra de créditos da plataforma via Stripe',
            });

          if (rpcError) {
            logStep("Error adding platform credits", { error: rpcError });
          } else {
            logStep("Platform credits added", { userId, amount: creditsAmount || Math.floor(amountUsdUnits), result });
          }

        } else if (paymentType === 'contract_funding') {
          const contractId = payment.contract_id;
          
          if (contractId) {
            logStep("Funding contract", { userId, contractId, amount: amountUsdUnits });
            
            const { data: result, error: rpcError } = await supabaseAdmin
              .rpc('fund_contract_escrow', {
                p_company_user_id: userId,
                p_contract_id: contractId,
                p_amount: amountUsdUnits,
                p_payment_id: paymentId,
              });

            if (rpcError) {
              logStep("Error funding contract escrow", { error: rpcError });
            } else {
              logStep("Contract escrow funded", { userId, contractId, amount: amountUsdUnits, result });
            }

            // Get freelancer from contract and credit their earnings
            const { data: contract } = await supabaseAdmin
              .from('contracts')
              .select('freelancer_user_id, currency')
              .eq('id', contractId)
              .single();

            if (contract?.freelancer_user_id) {
              const freelancerUserId = contract.freelancer_user_id;
              logStep("Crediting freelancer earnings", { freelancerUserId, amount: fxResult.amount_usd_minor });

              await supabaseAdmin.rpc('ensure_user_balance', {
                p_user_id: freelancerUserId,
                p_user_type: 'freelancer',
              });

              const { data: freelancerBalance } = await supabaseAdmin
                .from('user_balances')
                .select('earnings_available')
                .eq('user_id', freelancerUserId)
                .eq('user_type', 'freelancer')
                .single();

              const currentEarnings = freelancerBalance?.earnings_available || 0;
              const newEarnings = currentEarnings + fxResult.amount_usd_minor;

              const { error: updateError } = await supabaseAdmin
                .from('user_balances')
                .update({
                  earnings_available: newEarnings,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', freelancerUserId)
                .eq('user_type', 'freelancer');

              if (updateError) {
                logStep("Error updating freelancer earnings", { error: updateError });
              } else {
                logStep("Freelancer earnings credited", { freelancerUserId, newEarnings });

                await supabaseAdmin
                  .from('ledger_transactions')
                  .insert({
                    user_id: freelancerUserId,
                    tx_type: 'escrow_release',
                    amount: fxResult.amount_usd_minor,
                    currency: 'USD',
                    context: 'contract_funded_stripe',
                    related_contract_id: contractId,
                    related_payment_id: paymentId,
                    balance_after_earnings: newEarnings,
                    payment_currency: currency,
                    payment_amount_minor: amountTotal,
                    payment_method: 'card',
                    gateway_provider: 'stripe',
                    amount_usd_minor: fxResult.amount_usd_minor,
                    fx_rate_market: fxResult.fx_rate_market,
                    fx_rate_applied: fxResult.fx_rate_applied,
                    fx_spread_percent: fxResult.fx_spread_percent,
                    fx_spread_amount_usd_minor: fxResult.fx_spread_amount_usd_minor,
                    fx_provider: fxResult.fx_provider,
                    fx_timestamp: fxResult.fx_timestamp,
                  });

                const formattedAmount = (fxResult.amount_usd_minor / 100).toFixed(2);
                await supabaseAdmin
                  .from('notifications')
                  .insert({
                    user_id: freelancerUserId,
                    type: 'payment_received',
                    message: `Você recebeu USD ${formattedAmount}! O valor já está disponível para saque.`,
                    link: '/earnings',
                  });
                
                logStep("Freelancer notified", { freelancerUserId });
              }
            }
          } else {
            logStep("No contract_id for contract_funding payment", { paymentId });
          }
        }

        // Update related ledger transactions with FX data
        await supabaseAdmin
          .from('ledger_transactions')
          .update({
            payment_currency: currency,
            payment_amount_minor: amountTotal,
            payment_method: 'card',
            gateway_provider: 'stripe',
            amount_usd_minor: fxResult.amount_usd_minor,
            fx_rate_market: fxResult.fx_rate_market,
            fx_rate_applied: fxResult.fx_rate_applied,
            fx_spread_percent: fxResult.fx_spread_percent,
            fx_spread_amount_usd_minor: fxResult.fx_spread_amount_usd_minor,
            fx_provider: fxResult.fx_provider,
            fx_timestamp: fxResult.fx_timestamp,
          })
          .eq('related_payment_id', paymentId);

        // Send notification
        let notificationMessage = '';
        const originalAmount = (amountTotal / getMinorUnitDivisor(currency)).toFixed(2);
        
        if (paymentType === 'freelancer_credits') {
          notificationMessage = `Your ${creditsAmount || Math.floor(amountUsdUnits)} proposal credits have been added!`;
        } else if (paymentType === 'company_wallet' || paymentType === 'company_credits') {
          notificationMessage = `USD ${amountUsdUnits.toFixed(2)} added to your credits! (${currency} ${originalAmount})`;
        } else if (paymentType === 'contract_funding') {
          notificationMessage = `Payment of USD ${amountUsdUnits.toFixed(2)} deposited to escrow!`;
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
    }

    return new Response(JSON.stringify({ received: true }), {
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