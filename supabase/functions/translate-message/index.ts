import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Supported languages
const SUPPORTED_LANGS = ["pt-BR", "en", "es", "fr", "de", "zh"];

// Simple language detection based on common patterns
function detectLanguage(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Portuguese patterns
  if (/\b(você|não|está|isso|para|como|muito|também|são|têm|será|já|até|quando|porque|então|ainda|mais|pode|fazer|aqui|agora|bem|obrigado|olá|bom dia|boa tarde|boa noite)\b/.test(lowerText)) {
    return "pt-BR";
  }
  
  // Spanish patterns
  if (/\b(usted|está|esto|para|como|muy|también|son|tienen|será|ya|hasta|cuando|porque|entonces|todavía|más|puede|hacer|aquí|ahora|bien|gracias|hola|buenos días|buenas tardes|buenas noches)\b/.test(lowerText)) {
    return "es";
  }
  
  // French patterns
  if (/\b(vous|est|cela|pour|comment|très|aussi|sont|ont|sera|déjà|jusqu'à|quand|parce que|alors|encore|plus|peut|faire|ici|maintenant|bien|merci|bonjour|bonsoir)\b/.test(lowerText)) {
    return "fr";
  }
  
  // German patterns
  if (/\b(sie|ist|das|für|wie|sehr|auch|sind|haben|wird|schon|bis|wann|weil|dann|noch|mehr|kann|machen|hier|jetzt|gut|danke|hallo|guten tag|guten morgen|guten abend)\b/.test(lowerText)) {
    return "de";
  }
  
  // Chinese patterns (simplified check for common characters)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return "zh";
  }
  
  // Default to English
  return "en";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message_id, target_lang } = await req.json();

    if (!message_id || !target_lang) {
      return new Response(
        JSON.stringify({ error: "Missing message_id or target_lang" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[translate-message] User ${user.id} translating message ${message_id} to ${target_lang}`);

    // 1) Check if translation already exists in cache
    const { data: existingTranslation } = await supabase
      .from("message_translations")
      .select("*")
      .eq("message_id", message_id)
      .eq("target_lang", target_lang)
      .maybeSingle();

    if (existingTranslation) {
      console.log(`[translate-message] Cache hit for message ${message_id} -> ${target_lang}`);
      return new Response(
        JSON.stringify({ 
          translation: existingTranslation.translated_content,
          source_lang: existingTranslation.source_lang,
          cached: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Get the original message
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id, content, conversation_id, lang_detected")
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      console.error("Message not found:", msgError);
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Verify user has access to this conversation
    const { data: conversation } = await supabase
      .from("conversations")
      .select("company_user_id, freelancer_user_id")
      .eq("id", message.conversation_id)
      .single();

    if (!conversation || 
        (conversation.company_user_id !== user.id && conversation.freelancer_user_id !== user.id)) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Detect source language if not already detected
    let sourceLang = message.lang_detected;
    if (!sourceLang) {
      sourceLang = detectLanguage(message.content);
      // Update the message with detected language
      await supabase
        .from("messages")
        .update({ lang_detected: sourceLang })
        .eq("id", message_id);
    }

    // If source and target are the same, no translation needed
    if (sourceLang === target_lang || 
        (sourceLang === "pt-BR" && target_lang === "pt") ||
        (sourceLang === "pt" && target_lang === "pt-BR")) {
      return new Response(
        JSON.stringify({ 
          translation: message.content,
          source_lang: sourceLang,
          same_language: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) Translate using Lovable AI (Gemini)
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text from ${sourceLang} to ${target_lang}. 
Only output the translation, nothing else. Preserve the original tone, formality, and any technical terms.
Do not add any explanations, notes, or formatting.`
          },
          {
            role: "user",
            content: message.content
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI translation error:", errorText);
      return new Response(
        JSON.stringify({ error: "Translation service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const translatedContent = aiData.choices?.[0]?.message?.content?.trim();

    if (!translatedContent) {
      console.error("Empty translation response");
      return new Response(
        JSON.stringify({ error: "Translation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[translate-message] Translated: "${message.content.substring(0, 50)}..." -> "${translatedContent.substring(0, 50)}..."`);

    // 6) Cache the translation
    await supabase
      .from("message_translations")
      .insert({
        message_id,
        source_lang: sourceLang,
        target_lang,
        translated_content: translatedContent,
      });

    // 7) Log usage
    await supabase
      .from("genius_usage_log")
      .insert({
        user_id: user.id,
        user_type: conversation.company_user_id === user.id ? "company" : "freelancer",
        feature_type: "translate_message",
        model_used: "google/gemini-2.5-flash-lite",
        input_tokens: message.content.length / 4, // Rough estimate
        output_tokens: translatedContent.length / 4,
      });

    return new Response(
      JSON.stringify({
        translation: translatedContent,
        source_lang: sourceLang,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in translate-message:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
