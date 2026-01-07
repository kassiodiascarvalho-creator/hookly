import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-PAYMENT-STATUS] ${step}${detailsStr}`);
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
    
    if (!user?.id) {
      throw new Error("User not authenticated");
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

    const { paymentId } = body as Record<string, unknown>;

    if (!isValidUUID(paymentId)) {
      throw new Error("Invalid payment ID");
    }

    logStep("Checking payment status", { paymentId });

    // Get payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('unified_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', user.id) // Security: only allow user to check their own payments
      .single();

    if (paymentError || !payment) {
      logStep("Payment not found", { error: paymentError });
      throw new Error("Payment not found");
    }

    logStep("Payment found", { 
      paymentId: payment.id, 
      currentStatus: payment.status,
      provider: payment.provider,
      providerPaymentId: payment.provider_payment_id 
    });

    // If already paid, return immediately
    if (payment.status === 'paid') {
      return new Response(JSON.stringify({ 
        success: true,
        status: 'paid',
        message: 'Payment already confirmed',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If payment is from Mercado Pago and we have a provider payment ID, check with MP
    if (payment.provider === 'mercadopago' && payment.provider_payment_id) {
      const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!accessToken) {
        throw new Error("Mercado Pago not configured");
      }

      logStep("Fetching status from Mercado Pago", { mpPaymentId: payment.provider_payment_id });

      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${payment.provider_payment_id}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        logStep("Failed to fetch from MP", { status: response.status });
        // Return current DB status if we can't reach MP
        return new Response(JSON.stringify({ 
          success: true,
          status: payment.status,
          message: payment.status === 'pending' ? 'Payment still pending' : 'Payment status unknown',
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const mpPayment = await response.json();
      const mpStatus = mpPayment.status;
      const mpStatusDetail = mpPayment.status_detail;
      const newStatus = mapMPStatus(mpStatus);

      logStep("Mercado Pago status", { mpStatus, mpStatusDetail, newStatus });

      // If status changed, update our database
      if (newStatus !== payment.status) {
        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === 'paid') {
          updateData.paid_at = new Date().toISOString();
        }

        await supabaseAdmin
          .from('unified_payments')
          .update(updateData)
          .eq('id', payment.id);

        logStep("Payment status updated in DB", { newStatus });

        // If payment is now approved, execute financial effects
        if (newStatus === 'paid') {
          const paymentType = payment.payment_type;
          const userId = payment.user_id;
          const amountCents = payment.amount_cents;
          const creditsAmount = payment.credits_amount;

          if (paymentType === 'freelancer_credits' && creditsAmount) {
            const { error: rpcError } = await supabaseAdmin
              .rpc('add_freelancer_credits', {
                p_freelancer_user_id: userId,
                p_credits: creditsAmount,
                p_payment_id: payment.id,
                p_reason: 'credits_purchase_mercadopago_manual_check',
              });

            if (rpcError) {
              logStep("Error adding freelancer credits", { error: rpcError });
            } else {
              logStep("Freelancer credits added", { credits: creditsAmount });
            }
          } else if (paymentType === 'company_wallet') {
            const { error: rpcError } = await supabaseAdmin
              .rpc('credit_company_wallet', {
                p_company_user_id: userId,
                p_amount_cents: amountCents,
                p_payment_id: payment.id,
                p_reason: 'wallet_topup_mercadopago_manual_check',
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
              user_id: userId,
              type: 'payment_success',
              message: paymentType === 'freelancer_credits' 
                ? `Seus ${creditsAmount} créditos de proposta foram adicionados!`
                : `Seus fundos foram adicionados à sua carteira!`,
              link: '/settings?tab=billing',
            });
        }
      }

      // Return status with user-friendly messages
      let message = '';
      if (newStatus === 'paid') {
        message = 'Pagamento confirmado!';
      } else if (newStatus === 'pending') {
        message = 'Pagamento ainda não confirmado. Aguarde e tente novamente.';
      } else if (newStatus === 'failed') {
        if (mpStatusDetail === 'expired') {
          message = 'PIX expirado. Gere um novo QR Code.';
        } else if (mpStatusDetail === 'cc_rejected_call_for_authorize') {
          message = 'Pagamento recusado. Entre em contato com seu banco.';
        } else {
          message = 'Pagamento não confirmado. Gere um novo PIX.';
        }
      } else {
        message = 'Status do pagamento desconhecido.';
      }

      return new Response(JSON.stringify({ 
        success: true,
        status: newStatus,
        mpStatus,
        mpStatusDetail,
        message,
        expired: mpStatusDetail === 'expired',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // For non-MP payments or those without provider ID, return current status
    return new Response(JSON.stringify({ 
      success: true,
      status: payment.status,
      message: payment.status === 'pending' ? 'Aguardando confirmação' : 'Status atual do pagamento',
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
