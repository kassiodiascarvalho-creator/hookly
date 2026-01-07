import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FUND-CONTRACT-CREDITS] ${step}${detailsStr}`);
};

// Validation helpers
function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && 
         !isNaN(value) && 
         isFinite(value) && 
         value >= 100 && 
         value <= 100000000; // 1 to 1,000,000 in cents
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
    
    if (!user) {
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

    const { contractId, amountCents, freelancerUserId, description } = body as Record<string, unknown>;

    // Validate required fields
    if (!isValidUUID(contractId)) {
      throw new Error("Invalid contract ID");
    }
    if (!isValidAmount(amountCents)) {
      throw new Error("Amount must be between R$1 and R$1,000,000");
    }
    if (!isValidUUID(freelancerUserId)) {
      throw new Error("Invalid freelancer ID");
    }

    logStep("Request validated", { contractId, amountCents, freelancerUserId });

    // Verify the contract exists and belongs to the user
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('id, company_user_id, status, amount_cents, currency')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      logStep("Contract not found", { error: contractError });
      throw new Error("Contract not found");
    }

    if (contract.company_user_id !== user.id) {
      throw new Error("You are not authorized to fund this contract");
    }

    logStep("Contract verified", { contractId, status: contract.status });

    // Check user balance
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .select('credits_available')
      .eq('user_id', user.id)
      .eq('user_type', 'company')
      .single();

    if (balanceError || !balance) {
      logStep("Balance not found, creating...", { error: balanceError });
      
      // Create balance if not exists
      await supabaseAdmin.rpc('ensure_user_balance', {
        p_user_id: user.id,
        p_user_type: 'company',
      });

      // Re-fetch
      const { data: newBalance } = await supabaseAdmin
        .from('user_balances')
        .select('credits_available')
        .eq('user_id', user.id)
        .eq('user_type', 'company')
        .single();

      if (!newBalance || newBalance.credits_available < amountCents) {
        throw new Error("Insufficient balance");
      }
    } else if (balance.credits_available < amountCents) {
      throw new Error("Insufficient balance");
    }

    logStep("Balance verified", { available: balance?.credits_available, required: amountCents });

    // Create a unified_payments record for tracking
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('unified_payments')
      .insert({
        provider: 'credits',
        payment_type: 'contract_funding',
        user_id: user.id,
        user_type: 'company',
        amount_cents: amountCents,
        currency: contract.currency || 'BRL',
        contract_id: contractId,
        status: 'paid',
        paid_at: new Date().toISOString(),
        metadata: {
          description: description || null,
          freelancer_user_id: freelancerUserId,
          payment_method: 'credits',
        },
      })
      .select()
      .single();

    if (paymentError || !payment) {
      logStep("Failed to create payment record", { error: paymentError });
      throw new Error("Failed to create payment record");
    }

    logStep("Payment record created", { paymentId: payment.id });

    // Try to use the new ledger system first
    const { error: fundError } = await supabaseAdmin.rpc('fund_contract_escrow', {
      p_company_user_id: user.id,
      p_contract_id: contractId,
      p_amount: amountCents,
      p_payment_id: payment.id,
    });

    if (fundError) {
      logStep("fund_contract_escrow failed, trying fallback", { error: fundError.message });

      // Fallback: manually update balances
      // Debit credits_available
      const { error: debitError } = await supabaseAdmin
        .from('user_balances')
        .update({
          credits_available: (balance?.credits_available || 0) - amountCents,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('user_type', 'company');

      if (debitError) {
        logStep("Debit failed", { error: debitError });
        throw new Error("Failed to debit balance");
      }

      // Create ledger transaction
      await supabaseAdmin
        .from('ledger_transactions')
        .insert({
          user_id: user.id,
          tx_type: 'contract_funding',
          amount: amountCents,
          currency: contract.currency || 'BRL',
          context: `Contract funding via credits: ${contractId}`,
          related_contract_id: contractId,
          related_payment_id: payment.id,
        });
    }

    logStep("Contract funded successfully");

    // Update contract status to funded if applicable
    if (contract.status === 'draft' || contract.status === 'active') {
      await supabaseAdmin
        .from('contracts')
        .update({
          status: 'funded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contractId);

      logStep("Contract status updated to funded");
    }

    // Send notification to freelancer
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: freelancerUserId,
        type: 'contract_funded',
        message: `Um contrato foi financiado!`,
        link: `/contracts`,
      });

    logStep("Notification sent to freelancer");

    return new Response(JSON.stringify({
      success: true,
      paymentId: payment.id,
      message: "Contract funded successfully",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
