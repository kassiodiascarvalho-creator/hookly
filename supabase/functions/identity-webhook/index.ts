import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_IDENTITY_WEBHOOK_SECRET")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-12-18.acacia",
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("[IDENTITY-WH] Missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[IDENTITY-WH] Signature verification failed:", message);
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  console.log(`[IDENTITY-WH] Received event: ${event.type}`);

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    switch (event.type) {
      case "identity.verification_session.verified": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        console.log(`[IDENTITY-WH] Session verified: ${session.id}`);

        // Get the report for additional details
        let score = null;
        let riskLevel = "low";
        
        if (session.last_verification_report) {
          try {
            const report = await stripe.identity.verificationReports.retrieve(
              session.last_verification_report as string
            );
            
            // Check for any risk signals
            if (report.document?.status === "verified" && report.selfie?.status === "verified") {
              riskLevel = "low";
              score = 1.0;
            } else {
              riskLevel = "medium";
              score = 0.7;
            }
          } catch (e) {
            console.error("[IDENTITY-WH] Error fetching report:", e);
          }
        }

        const { error } = await supabaseAdmin.rpc("update_identity_from_webhook", {
          p_provider_session_id: session.id,
          p_status: "verified",
          p_report_id: session.last_verification_report,
          p_score: score,
          p_risk_level: riskLevel,
          p_metadata: {
            verified_outputs: session.verified_outputs,
            redaction: session.redaction,
          },
        });

        if (error) {
          console.error("[IDENTITY-WH] Error updating verification:", error);
          throw error;
        }
        break;
      }

      case "identity.verification_session.requires_input": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        console.log(`[IDENTITY-WH] Session requires input: ${session.id}`);

        let failureReason = "Document or selfie needs to be recaptured";
        let failureCode = "requires_input";
        let riskLevel: string | null = null;

        // Check last error if available
        if (session.last_error) {
          failureCode = session.last_error.code || "unknown";
          failureReason = session.last_error.reason || failureReason;
          
          // Determine risk level based on error type
          if (failureCode === "document_type_not_allowed" || failureCode === "document_expired") {
            riskLevel = "low";
          } else if (failureCode === "selfie_document_missing_photo" || failureCode === "selfie_face_mismatch") {
            riskLevel = "high";
          } else if (failureCode === "under_supported_age" || failureCode === "id_number_mismatch") {
            riskLevel = "hard";
          }
        }

        const { error } = await supabaseAdmin.rpc("update_identity_from_webhook", {
          p_provider_session_id: session.id,
          p_status: "requires_input",
          p_failure_reason: failureReason,
          p_failure_code: failureCode,
          p_risk_level: riskLevel,
          p_metadata: { last_error: session.last_error },
        });

        if (error) {
          console.error("[IDENTITY-WH] Error updating verification:", error);
          throw error;
        }
        break;
      }

      case "identity.verification_session.canceled": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        console.log(`[IDENTITY-WH] Session canceled: ${session.id}`);

        const { error } = await supabaseAdmin.rpc("update_identity_from_webhook", {
          p_provider_session_id: session.id,
          p_status: "canceled",
          p_failure_reason: "Verification was canceled",
          p_failure_code: "canceled",
        });

        if (error) {
          console.error("[IDENTITY-WH] Error updating verification:", error);
          throw error;
        }
        break;
      }

      case "identity.verification_session.processing": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        console.log(`[IDENTITY-WH] Session processing: ${session.id}`);

        const { error } = await supabaseAdmin.rpc("update_identity_from_webhook", {
          p_provider_session_id: session.id,
          p_status: "processing",
        });

        if (error) {
          console.error("[IDENTITY-WH] Error updating verification:", error);
          throw error;
        }
        break;
      }

      case "identity.verification_session.redacted": {
        const session = event.data.object as Stripe.Identity.VerificationSession;
        console.log(`[IDENTITY-WH] Session redacted: ${session.id}`);
        // Data has been redacted, log for compliance but no action needed
        break;
      }

      default:
        console.log(`[IDENTITY-WH] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("[IDENTITY-WH] Processing error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
