import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FreelancerProfile {
  full_name: string | null;
  title: string | null;
  bio: string | null;
  skills: string[] | null;
  languages: string[] | null;
  hourly_rate: number | null;
  tier: string | null;
  verified: boolean | null;
}

interface Project {
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
}

interface CompanyProfile {
  company_name: string | null;
  industry: string | null;
  is_verified: boolean | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, tone = "professional", language = "pt" } = await req.json();

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "Project ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, 
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check genius access
    const { data: accessData } = await supabase
      .from("genius_access")
      .select("*")
      .eq("user_id", user.id)
      .eq("feature_type", "proposal_ai")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check if user has elite plan
    const { data: planData } = await supabase
      .from("freelancer_plans")
      .select("plan_type, status")
      .eq("freelancer_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const hasElitePlan = planData?.plan_type === "elite" || planData?.plan_type === "pro";
    const hasActiveAccess = accessData !== null || hasElitePlan;

    if (!hasActiveAccess) {
      return new Response(
        JSON.stringify({ 
          error: "no_access",
          message: "Você precisa de um plano Elite/Pro ou comprar acesso temporário com créditos",
          requiresUpgrade: true
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch freelancer profile
    const { data: freelancer, error: freelancerError } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (freelancerError || !freelancer) {
      return new Response(
        JSON.stringify({ error: "Freelancer profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company profile
    const { data: company } = await supabase
      .from("company_profiles")
      .select("company_name, industry, is_verified")
      .eq("user_id", project.company_user_id)
      .single();

    // Fetch freelancer's certifications
    const { data: certifications } = await supabase
      .from("certifications")
      .select("name, issuer")
      .eq("freelancer_user_id", user.id);

    // Fetch portfolio items
    const { data: portfolio } = await supabase
      .from("portfolio_items")
      .select("title, description, tags")
      .eq("freelancer_user_id", user.id)
      .limit(5);

    // Fetch previous successful proposals
    const { data: previousProposals } = await supabase
      .from("proposals")
      .select("cover_letter")
      .eq("freelancer_user_id", user.id)
      .eq("status", "accepted")
      .limit(3);

    // Build context for AI
    const freelancerContext = {
      name: freelancer.full_name || "Freelancer",
      title: freelancer.title || "",
      bio: freelancer.bio || "",
      skills: freelancer.skills || [],
      languages: freelancer.languages || [],
      hourlyRate: freelancer.hourly_rate,
      tier: freelancer.tier,
      verified: freelancer.verified,
      certifications: certifications?.map(c => `${c.name}${c.issuer ? ` (${c.issuer})` : ""}`) || [],
      portfolioHighlights: portfolio?.map(p => p.title) || [],
    };

    const projectContext = {
      title: project.title,
      description: project.description || "",
      category: project.category || "",
      budget: project.budget_min && project.budget_max 
        ? `${project.budget_min} - ${project.budget_max} ${project.currency}`
        : "Não especificado",
      company: company?.company_name || "Empresa",
      industry: company?.industry || "",
    };

    const toneDescriptions: Record<string, string> = {
      professional: "tom profissional e corporativo",
      creative: "tom criativo e entusiasmado",
      direct: "tom direto e objetivo",
      technical: "tom técnico e detalhado",
      friendly: "tom amigável e acessível",
    };

    const systemPrompt = `Você é o Hookly Genius, um assistente de IA especializado em criar propostas profissionais para freelancers.

REGRAS CRÍTICAS:
1. NUNCA invente qualificações, experiências ou certificações que o freelancer não possui
2. Use APENAS as informações fornecidas sobre o perfil do freelancer
3. Se faltarem informações importantes, mencione de forma positiva o que está disponível
4. Mantenha a proposta honesta, convincente e personalizada
5. Adapte ao tom solicitado: ${toneDescriptions[tone] || toneDescriptions.professional}
6. Escreva em ${language === "pt" ? "português brasileiro" : language === "en" ? "inglês" : language}

ESTRUTURA DA PROPOSTA:
1. Cumprimento personalizado mencionando o projeto
2. Por que você é ideal para este projeto (baseado em habilidades REAIS)
3. Experiência relevante (apenas o que o perfil comprova)
4. Abordagem proposta para o projeto
5. Chamada para ação

DADOS DO FREELANCER (use apenas estes):
${JSON.stringify(freelancerContext, null, 2)}

DADOS DO PROJETO:
${JSON.stringify(projectContext, null, 2)}

${previousProposals && previousProposals.length > 0 ? `
EXEMPLOS DE PROPOSTAS ANTERIORES ACEITAS (para referência de estilo):
${previousProposals.map(p => p.cover_letter?.substring(0, 300) + "...").join("\n---\n")}
` : ""}

Crie uma proposta persuasiva, honesta e personalizada.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Gere uma proposta para o projeto "${project.title}".` },
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const proposal = aiData.choices?.[0]?.message?.content || "";

    // Log usage
    await supabase.from("genius_usage_log").insert({
      user_id: user.id,
      user_type: "freelancer",
      feature_type: "proposal_ai",
      project_id: projectId,
      input_tokens: aiData.usage?.prompt_tokens || 0,
      output_tokens: aiData.usage?.completion_tokens || 0,
      model_used: "gemini-3-flash-preview",
    });

    return new Response(
      JSON.stringify({ 
        proposal,
        generatedAt: new Date().toISOString(),
        tone,
        language,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Genius proposal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
