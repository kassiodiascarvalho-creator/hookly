import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  console.log(JSON.stringify({ step, details, timestamp: new Date().toISOString() }));
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Not authenticated" });
    }

    // Create Supabase client with the auth header for proper user context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");

    // Prefer getClaims() over getUser(): getUser() can fail with `session_not_found`
    // if the session_id referenced by the JWT has been cleaned up server-side.
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      logStep("Auth claims error", { code: (claimsError as any)?.code, message: String(claimsError) });
      return json(401, { error: "Not authenticated" });
    }

    const userId = claimsData.claims.sub as string;
    if (!userId) {
      return json(401, { error: "Not authenticated" });
    }

    logStep("User authenticated", { userId });

    // Get company plan
    const { data: companyPlan, error: planError } = await supabaseClient
      .from("company_plans")
      .select("*")
      .eq("company_user_id", userId)
      .maybeSingle();

    if (planError) {
      logStep("Error fetching plan", planError);
      throw planError;
    }

    // Base response for free/manual plans
    const baseResponse = {
      plan_type: companyPlan?.plan_type || "free",
      plan_source: companyPlan?.plan_source || null,
      status: companyPlan?.status || null,
      subscription: null,
      upcomingInvoice: null,
      invoices: [],
      hasStripeCustomer: false,
    };

    // If no Stripe customer, return basic info
    if (!companyPlan?.stripe_customer_id) {
      logStep("No Stripe customer", { planType: companyPlan?.plan_type });
      return new Response(JSON.stringify(baseResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });
    
    logStep("Fetching Stripe data", { customerId: companyPlan.stripe_customer_id });

    // Get subscription info
    let subscription = null;
    if (companyPlan.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(companyPlan.stripe_subscription_id);
        subscription = {
          id: sub.id,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        };
        logStep("Subscription found", subscription);
      } catch (e) {
        logStep("Subscription not found or error", e);
      }
    }

    // Get upcoming invoice
    let upcomingInvoice = null;
    try {
      const upcoming = await stripe.invoices.retrieveUpcoming({
        customer: companyPlan.stripe_customer_id,
      });
      upcomingInvoice = {
        amount_due: upcoming.amount_due,
        currency: upcoming.currency,
        due_date: upcoming.due_date ? new Date(upcoming.due_date * 1000).toISOString() : null,
        period_start: upcoming.period_start ? new Date(upcoming.period_start * 1000).toISOString() : null,
        period_end: upcoming.period_end ? new Date(upcoming.period_end * 1000).toISOString() : null,
      };
      logStep("Upcoming invoice found", upcomingInvoice);
    } catch (e) {
      logStep("No upcoming invoice", e);
    }

    // Get recent invoices
    const invoicesResp = await stripe.invoices.list({
      customer: companyPlan.stripe_customer_id,
      limit: 10,
    });

    const invoices = invoicesResp.data.map((inv: any) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }));

    logStep("Invoices fetched", { count: invoices.length });

    return json(200, {
      ...baseResponse,
      subscription,
      upcomingInvoice,
      invoices,
      hasStripeCustomer: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { message });
    return json(500, { error: message });
  }
});
