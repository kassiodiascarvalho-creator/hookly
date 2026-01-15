import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCodeRequest {
  email: string;
  userId: string;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, userId }: SendCodeRequest = await req.json();

    if (!email || !userId) {
      return new Response(
        JSON.stringify({ error: "Email and userId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit OTP
    const code = generateOTP();

    // Delete any existing codes for this user
    await supabase
      .from("email_verification_codes")
      .delete()
      .eq("user_id", userId);

    // Insert new code with 10 minute expiration
    const { error: insertError } = await supabase
      .from("email_verification_codes")
      .insert({
        user_id: userId,
        email: email.toLowerCase(),
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error("Error inserting verification code:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email with OTP using Resend
    const emailResponse = await resend.emails.send({
      from: "HOOKLY <noreply@resend.dev>",
      to: [email],
      subject: "Seu código de verificação HOOKLY",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 400px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 600; color: #1a1a1a; text-align: center;">
              HOOKLY
            </h1>
            <p style="margin: 0 0 24px; font-size: 16px; color: #666666; text-align: center;">
              Use o código abaixo para verificar seu email:
            </p>
            <div style="background: #f0f0f0; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">
                ${code}
              </span>
            </div>
            <p style="margin: 0; font-size: 14px; color: #999999; text-align: center;">
              Este código expira em 10 minutos.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
