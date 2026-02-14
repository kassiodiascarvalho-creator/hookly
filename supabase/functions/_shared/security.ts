/**
 * SHARED SECURITY UTILITIES
 * Use these across all Edge Functions for consistent security practices
 */

// ============================================
// RESTRICTIVE CORS (For Internal APIs)
// ============================================

export const SAFE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// For webhooks (Stripe, MP, etc.) that need to accept from any origin
export const WEBHOOK_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Security headers to include in all responses
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
};

// ============================================
// SAFE LOGGING (No Sensitive Data)
// ============================================

const SENSITIVE_FIELDS = [
  'password', 'token', 'apiKey', 'secret', 'authorization',
  'accessToken', 'refreshToken', 'privateKey', 'creditCard',
  'cardNumber', 'cvv', 'cvc', 'ssn', 'documentNumber',
  'cpf', 'cnpj', 'rg', 'passportNumber', 'bankAccount',
];

export function safeLog(prefix: string, step: string, details?: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = { ...details };
  
  // Remove sensitive fields
  SENSITIVE_FIELDS.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
    // Also check nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        const nested = sanitized[key] as Record<string, unknown>;
        if (field in nested) {
          delete nested[field];
        }
      }
    });
  });
  
  // Redact email (show only first char + domain)
  if (sanitized.email && typeof sanitized.email === 'string') {
    const [local, domain] = sanitized.email.split('@');
    sanitized.email = domain ? `${local[0]}***@${domain}` : '***@***';
  }
  
  // Redact long IDs (show only last 4 chars)
  if (sanitized.userId && typeof sanitized.userId === 'string' && sanitized.userId.length > 10) {
    sanitized.userId = `***${sanitized.userId.slice(-4)}`;
  }
  
  if (sanitized.paymentId && typeof sanitized.paymentId === 'string' && sanitized.paymentId.length > 10) {
    sanitized.paymentId = `***${sanitized.paymentId.slice(-4)}`;
  }
  
  const detailsStr = Object.keys(sanitized).length > 0 ? ` - ${JSON.stringify(sanitized)}` : '';
  console.log(`[${prefix}] ${step}${detailsStr}`);
}

// ============================================
// INPUT VALIDATION
// ============================================

export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function sanitizeString(input: string, maxLength = 1000): string {
  // Remove potentially dangerous characters
  return input.replace(/[<>\"']/g, '').slice(0, maxLength);
}

export function isValidAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && 
         !isNaN(amount) && 
         isFinite(amount) && 
         amount >= 0 && 
         amount <= 1000000000; // Max 1 billion
}

// ============================================
// MERCADO PAGO WEBHOOK SIGNATURE VERIFICATION
// ============================================

export async function verifyMercadoPagoSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string,
  secret: string
): Promise<boolean> {
  if (!xSignature || !xRequestId || !secret) {
    return false;
  }

  try {
    // Parse x-signature header
    // Format: "ts=xxx,v1=yyy"
    const signatureParts: Record<string, string> = {};
    xSignature.split(',').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        signatureParts[key.trim()] = value.trim();
      }
    });

    const ts = signatureParts.ts;
    const v1 = signatureParts.v1;

    if (!ts || !v1) {
      return false;
    }

    // Build the manifest string
    // Template: id:[data.id];request-id:[x-request-id];ts:[ts];
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calculate HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(manifest)
    );

    // Convert to hex
    const calculatedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison to prevent timing attacks
    if (calculatedSignature.length !== v1.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < calculatedSignature.length; i++) {
      result |= calculatedSignature.charCodeAt(i) ^ v1.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// ============================================
// RATE LIMITING HELPER
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(
  supabase: any,
  table: string,
  identifierColumn: string,
  identifierValue: string,
  windowSeconds: number,
  maxRequests: number
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(identifierColumn, identifierValue)
    .gte('created_at', windowStart);

  if (error) {
    // On error, allow the request but log it
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }

  if ((count ?? 0) >= maxRequests) {
    return { 
      allowed: false, 
      retryAfterSeconds: windowSeconds 
    };
  }

  return { allowed: true };
}

// ============================================
// RESPONSE HELPERS
// ============================================

export function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders = SAFE_CORS_HEADERS
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS,
        "Content-Type": "application/json",
      },
    }
  );
}

export function errorResponse(
  message: string,
  status = 500,
  corsHeaders = SAFE_CORS_HEADERS
): Response {
  // Never expose internal error details in production
  const safeMessage = status >= 500 ? "Internal server error" : message;
  
  return jsonResponse({ error: safeMessage }, status, corsHeaders);
}
