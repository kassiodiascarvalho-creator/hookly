import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  country: string;
  documentType: string;
  subjectType: "freelancer" | "company";
}

const DOCUMENT_TYPE_MAP: Record<string, string[]> = {
  BR: ["cnh", "rg", "passport"],
  US: ["passport", "drivers_license", "national_id"],
  DEFAULT: ["passport", "national_id", "drivers_license", "residence_permit"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.id;
    const userEmail = authUser.email || "";

    const body: RequestBody = await req.json();
    const { country, documentType, subjectType } = body;

    // Validate inputs
    if (!country || !documentType || !subjectType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: country, documentType, subjectType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["freelancer", "company"].includes(subjectType)) {
      return new Response(
        JSON.stringify({ error: "Invalid subjectType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate document type for country
    const allowedDocs = DOCUMENT_TYPE_MAP[country] || DOCUMENT_TYPE_MAP.DEFAULT;
    if (!allowedDocs.includes(documentType)) {
      return new Response(
        JSON.stringify({ error: `Document type ${documentType} not allowed for country ${country}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check current verification status
    const { data: statusData, error: statusError } = await supabaseAdmin
      .rpc("get_identity_status", { p_user_id: userId, p_subject_type: subjectType });

    if (statusError) {
      console.error("[IDENTITY] Status check error:", statusError);
      throw statusError;
    }

    const status = statusData as {
      status: string;
      can_start_verification: boolean;
      attempts: number;
      max_attempts: number;
    };

    if (!status.can_start_verification) {
      if (status.status === "verified") {
        return new Response(
          JSON.stringify({ error: "Already verified", code: "ALREADY_VERIFIED" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status.status === "manual_review") {
        return new Response(
          JSON.stringify({ error: "Verification under manual review", code: "MANUAL_REVIEW" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status.attempts >= status.max_attempts) {
        return new Response(
          JSON.stringify({ error: "Maximum attempts reached", code: "MAX_ATTEMPTS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create Stripe Identity VerificationSession
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Get user name for metadata
    let userName = "";
    if (subjectType === "freelancer") {
      const { data: profile } = await supabaseAdmin
        .from("freelancer_profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();
      userName = profile?.full_name || "";
    } else {
      const { data: profile } = await supabaseAdmin
        .from("company_profiles")
        .select("company_name, contact_name")
        .eq("user_id", userId)
        .single();
      userName = profile?.contact_name || profile?.company_name || "";
    }

    console.log(`[IDENTITY] Creating session for ${subjectType} ${userId}, country: ${country}, doc: ${documentType}`);

    const verificationSession = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: documentType === "passport" ? ["passport"] : 
                        documentType === "drivers_license" || documentType === "cnh" ? ["driving_license"] : 
                        ["id_card"],
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      metadata: {
        user_id: userId,
        subject_type: subjectType,
        country: country,
        document_type: documentType,
        platform: "hookly",
      },
      provided_details: {
        email: userEmail,
      },
    });

    console.log(`[IDENTITY] Session created: ${verificationSession.id}`);

    // Create verification record in database
    const { data: verificationId, error: createError } = await supabaseAdmin
      .rpc("create_identity_session", {
        p_user_id: userId,
        p_subject_type: subjectType,
        p_country: country,
        p_document_type: documentType,
        p_provider_session_id: verificationSession.id,
      });

    if (createError) {
      console.error("[IDENTITY] Create session error:", createError);
      // Try to cancel the Stripe session since DB failed
      try {
        await stripe.identity.verificationSessions.cancel(verificationSession.id);
      } catch (e) {
        console.error("[IDENTITY] Failed to cancel Stripe session:", e);
      }
      throw createError;
    }

    console.log(`[IDENTITY] DB record created: ${verificationId}`);

    return new Response(
      JSON.stringify({
        success: true,
        verificationId,
        clientSecret: verificationSession.client_secret,
        sessionId: verificationSession.id,
        url: verificationSession.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[IDENTITY] Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
