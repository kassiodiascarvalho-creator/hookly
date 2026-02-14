import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { 
  SAFE_CORS_HEADERS, 
  safeLog, 
  isValidEmail, 
  isValidUUID,
  jsonResponse,
  errorResponse 
} from "../_shared/security.ts";

interface SendCodeRequest {
  email: string;
  userId: string;
}

function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

const RATE_LIMIT_SECONDS = 60; // 1 request per minute per email

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: SAFE_CORS_HEADERS });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { email, userId } = body as SendCodeRequest;

    // Input validation
    if (!email || !isValidEmail(email)) {
      return errorResponse("Invalid email format", 400, SAFE_CORS_HEADERS);
    }

    if (!userId || !isValidUUID(userId)) {
      return errorResponse("Invalid userId format", 400, SAFE_CORS_HEADERS);
    }

    safeLog("SEND-VERIFICATION", "Request received", { email, userId });

    // RATE LIMITING: Check if code was sent recently
    const rateLimitWindow = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
    
    const { data: recentCode } = await supabase
      .from("email_verification_codes")
      .select("created_at")
      .eq("email", email.toLowerCase())
      .gte("created_at", rateLimitWindow)
      .maybeSingle();

    if (recentCode) {
      safeLog("SEND-VERIFICATION", "Rate limit hit", { email });
      return jsonResponse(
        { error: `Please wait ${RATE_LIMIT_SECONDS} seconds before requesting a new code` },
        429,
        SAFE_CORS_HEADERS
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
      safeLog("SEND-VERIFICATION", "Insert error", { errorType: insertError.code });
      return errorResponse("Failed to create verification code", 500, SAFE_CORS_HEADERS);
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

    safeLog("SEND-VERIFICATION", "Email sent", { success: true });

    return jsonResponse(
      { success: true, message: "Verification code sent" },
      200,
      SAFE_CORS_HEADERS
    );
  } catch (error) {
    safeLog("SEND-VERIFICATION", "Error", { errorType: (error as Error).constructor.name });
    return errorResponse("Failed to send verification code", 500, SAFE_CORS_HEADERS);
  }
};

serve(handler);
