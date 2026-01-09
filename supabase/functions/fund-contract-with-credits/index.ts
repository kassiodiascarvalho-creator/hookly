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
    logStep("Function started - INTERNAL LEDGER MOVEMENT (no external payment)");

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

    const { contractId, amountCents, freelancerUserId, description, milestoneIndex } = body as Record<string, unknown>;

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

    logStep("Request validated", { contractId, amountCents, freelancerUserId, milestoneIndex });

    // Verify the contract exists and belongs to the user
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('id, company_user_id, freelancer_user_id, status, amount_cents, currency')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) {
      logStep("Contract not found", { error: contractError });
      throw new Error("Contract not found");
    }

    if (contract.company_user_id !== user.id) {
      throw new Error("You are not authorized to fund this contract");
    }

    logStep("Contract verified", { 
      contractId, 
      status: contract.status,
      contractAmount: contract.amount_cents,
      requestedAmount: amountCents 
    });

    // Validate amount doesn't exceed contract value
    if (amountCents > contract.amount_cents) {
      throw new Error(`Amount cannot exceed contract value of ${contract.amount_cents / 100}`);
    }

    // Check user balance (credits_available in user_balances table)
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('user_balances')
      .select('id, credits_available, escrow_held')
      .eq('user_id', user.id)
      .eq('user_type', 'company')
      .single();

    let currentBalance = balanceData;

    if (balanceError || !currentBalance) {
      logStep("Balance not found, creating new record");
      
      // Create balance if not exists
      await supabaseAdmin.rpc('ensure_user_balance', {
        p_user_id: user.id,
        p_user_type: 'company',
      });

      // Re-fetch
      const { data: newBalance, error: balanceRetryError } = await supabaseAdmin
        .from('user_balances')
        .select('id, credits_available, escrow_held')
        .eq('user_id', user.id)
        .eq('user_type', 'company')
        .single();

      if (balanceRetryError || !newBalance) {
        throw new Error("Failed to retrieve or create user balance");
      }
      
      currentBalance = newBalance;
    }

    const creditsAvailable = currentBalance.credits_available;
    const currentEscrow = currentBalance.escrow_held || 0;
    
    if (creditsAvailable < amountCents) {
      logStep("Insufficient balance", { available: creditsAvailable, required: amountCents });
      throw new Error(`Saldo insuficiente. Disponível: ${creditsAvailable / 100}, Necessário: ${amountCents / 100}`);
    }

    logStep("Balance verified", { creditsAvailable, requiredAmount: amountCents });

    // ====================================================================
    // INTERNAL LEDGER MOVEMENT - NO EXTERNAL PAYMENT
    // This is a SIMULATION of payment, not real money movement
    // The freelancer will see credits, NOT real money
    // ====================================================================

    // Generate idempotency reference (internal, not from payment gateway)
    const internalReference = `internal_funding_${contractId}_${Date.now()}`;

    // Check for duplicate funding (idempotency)
    const { data: existingFunding } = await supabaseAdmin
      .from('ledger_transactions')
      .select('id')
      .eq('related_contract_id', contractId)
      .eq('tx_type', 'contract_funding')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (existingFunding) {
      logStep("Contract already funded (idempotency check)", { existingId: existingFunding.id });
      return new Response(JSON.stringify({
        success: true,
        message: "Contract already funded",
        alreadyFunded: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // STEP 1: Debit credits_available (remove from available balance)
    const newCreditsAvailable = creditsAvailable - amountCents;
    const newEscrowHeld = currentEscrow + amountCents;

    const { error: updateBalanceError } = await supabaseAdmin
      .from('user_balances')
      .update({
        credits_available: newCreditsAvailable,
        escrow_held: newEscrowHeld,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('user_type', 'company');

    if (updateBalanceError) {
      logStep("Failed to update balance", { error: updateBalanceError });
      throw new Error("Failed to update balance");
    }

    logStep("Balance updated", { 
      previousCredits: creditsAvailable,
      newCredits: newCreditsAvailable,
      previousEscrow: currentEscrow,
      newEscrow: newEscrowHeld,
    });

    // STEP 2: Record in ledger_transactions as internal simulation
    const { error: ledgerError } = await supabaseAdmin
      .from('ledger_transactions')
      .insert({
        user_id: user.id,
        tx_type: 'contract_funding',
        amount: amountCents,
        currency: contract.currency || 'BRL',
        context: description || `Internal funding for contract: ${contractId}`,
        related_contract_id: contractId,
        balance_after_credits: newCreditsAvailable,
        balance_after_escrow: newEscrowHeld,
        metadata: {
          funding_type: 'internal_credits',
          milestone_index: milestoneIndex ?? null,
          freelancer_user_id: freelancerUserId,
          internal_reference: internalReference,
          // Flag to indicate this was NOT a real payment
          is_real_payment: false,
        },
      });

    if (ledgerError) {
      logStep("Failed to record ledger transaction, attempting rollback", { error: ledgerError });
      
      // Rollback balance
      await supabaseAdmin
        .from('user_balances')
        .update({
          credits_available: creditsAvailable,
          escrow_held: currentEscrow,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('user_type', 'company');

      throw new Error("Failed to record transaction");
    }

    logStep("Ledger transaction recorded (internal simulation)");

    // STEP 3: Update contract status to funded
    const { error: contractUpdateError } = await supabaseAdmin
      .from('contracts')
      .update({
        status: 'funded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    if (contractUpdateError) {
      logStep("Warning: Failed to update contract status", { error: contractUpdateError });
      // Don't throw - the funding was successful, just the status update failed
    } else {
      logStep("Contract status updated to 'funded'");
    }

    // STEP 4: Send notification to freelancer
    // Note: Freelancer sees internal credits, NOT real money
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: freelancerUserId,
        type: 'milestone_funded',
        message: `Um milestone foi financiado! O valor está em escrow aguardando aprovação.`,
        link: `/contracts`,
      });

    if (notificationError) {
      logStep("Warning: Failed to send notification", { error: notificationError });
    } else {
      logStep("Notification sent to freelancer");
    }

    logStep("SUCCESS - Internal funding completed", {
      contractId,
      amountCents,
      newCreditsAvailable,
      newEscrowHeld,
      internalReference,
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Milestone financiado com sucesso (saldo interno)",
      funding: {
        type: 'internal_credits',
        amountCents,
        newBalance: newCreditsAvailable,
        escrowHeld: newEscrowHeld,
        contractId,
        isRealPayment: false, // Flag: this is NOT real money
      },
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
