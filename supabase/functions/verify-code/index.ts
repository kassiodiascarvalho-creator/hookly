import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyCodeRequest {
  email: string;
  code: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, code, userId }: VerifyCodeRequest = await req.json();

    if (!email || !code || !userId) {
      return new Response(
        JSON.stringify({ error: "Email, code, and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the verification code
    const { data: verificationCode, error: findError } = await supabase
      .from("email_verification_codes")
      .select("*")
      .eq("user_id", userId)
      .eq("email", email.toLowerCase())
      .eq("code", code)
      .is("verified_at", null)
      .single();

    if (findError || !verificationCode) {
      return new Response(
        JSON.stringify({ error: "invalid_code", message: "Código inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if code is expired
    if (new Date(verificationCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "code_expired", message: "Código expirado. Solicite um novo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as verified
    await supabase
      .from("email_verification_codes")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", verificationCode.id);

    // Update user's email_confirmed_at in auth.users using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (updateError) {
      console.error("Error confirming user email:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to confirm email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up old codes for this user
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ success: true, message: "Email verified successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
