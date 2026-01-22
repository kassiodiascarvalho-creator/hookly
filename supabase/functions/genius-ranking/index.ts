import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProposalWithFreelancer {
  id: string;
  cover_letter: string | null;
  created_at: string;
  is_highlighted: boolean;
  freelancer_user_id: string;
  freelancer: {
    full_name: string | null;
    title: string | null;
    skills: string[] | null;
    tier: string | null;
    verified: boolean | null;
    hourly_rate: number | null;
  };
  certifications_count: number;
  reviews_avg: number | null;
  reviews_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, language = "pt" } = await req.json();

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

    // Verify project belongs to company
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("company_user_id", user.id)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "Project not found or unauthorized" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check genius access
    const { data: accessData } = await supabase
      .from("genius_access")
      .select("*")
      .eq("user_id", user.id)
      .eq("feature_type", "ranking_ai")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check if company has elite/pro plan
    const { data: planData } = await supabase
      .from("company_plans")
      .select("plan_type, status")
      .eq("company_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const hasElitePlan = planData?.plan_type === "elite" || planData?.plan_type === "pro";
    const hasActiveAccess = accessData !== null || hasElitePlan;

    if (!hasActiveAccess) {
      return new Response(
        JSON.stringify({
          error: "no_access",
          message: "Você precisa de um plano Empresarial ou comprar acesso temporário com créditos",
          requiresUpgrade: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch proposals with freelancer data
    const { data: proposals, error: proposalsError } = await supabase
      .from("proposals")
      .select(`
        id,
        cover_letter,
        created_at,
        is_highlighted,
        freelancer_user_id,
        milestones
      `)
      .eq("project_id", projectId)
      .eq("status", "pending");

    if (proposalsError) {
      throw proposalsError;
    }

    if (!proposals || proposals.length === 0) {
      return new Response(
        JSON.stringify({
          rankings: [],
          summary: "Nenhuma proposta recebida ainda para este projeto.",
          generatedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enrich proposals with freelancer data
    const enrichedProposals = await Promise.all(
      proposals.map(async (proposal) => {
        const { data: freelancer } = await supabase
          .from("freelancer_profiles")
          .select("full_name, title, skills, tier, verified, hourly_rate, bio")
          .eq("user_id", proposal.freelancer_user_id)
          .single();

        const { count: certsCount } = await supabase
          .from("certifications")
          .select("*", { count: "exact", head: true })
          .eq("freelancer_user_id", proposal.freelancer_user_id);

        const { data: reviews } = await supabase
          .from("reviews")
          .select("rating")
          .eq("freelancer_user_id", proposal.freelancer_user_id);

        const avgRating = reviews?.length
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null;

        // Calculate total from milestones
        let proposedAmount = 0;
        if (proposal.milestones && Array.isArray(proposal.milestones)) {
          proposedAmount = proposal.milestones.reduce(
            (sum: number, m: any) => sum + (Number(m.amount) || 0), 
            0
          );
        }

        return {
          id: proposal.id,
          coverLetter: proposal.cover_letter || "",
          isHighlighted: proposal.is_highlighted,
          createdAt: proposal.created_at,
          proposedAmount,
          freelancer: {
            userId: proposal.freelancer_user_id,
            name: freelancer?.full_name || "Freelancer",
            title: freelancer?.title || "",
            skills: freelancer?.skills || [],
            tier: freelancer?.tier || "standard",
            verified: freelancer?.verified || false,
            hourlyRate: freelancer?.hourly_rate,
            bio: freelancer?.bio || "",
          },
          certifications: certsCount || 0,
          averageRating: avgRating,
          reviewsCount: reviews?.length || 0,
        };
      })
    );

    // Build AI prompt
    const systemPrompt = `Você é o Hookly Genius, um assistente de IA especializado em analisar propostas de freelancers.

OBJETIVO: Analisar as propostas recebidas e ranquear os freelancers mais adequados para o projeto.

CRITÉRIOS DE AVALIAÇÃO (peso de 1-10):
1. EXPERIÊNCIA (30%): Compatibilidade entre perfil/habilidades e requisitos do projeto
2. QUALIDADE DA PROPOSTA (25%): Clareza, personalização, entendimento do escopo
3. NÍVEL DO PERFIL (20%): Tier (elite > top_rated > verified > standard), avaliações, verificação
4. MATCH TÉCNICO (15%): Habilidades específicas mencionadas vs. requisitos
5. CUSTO-BENEFÍCIO (10%): Relação entre valor proposto e qualidade esperada

FORMATO DE RESPOSTA (JSON):
{
  "rankings": [
    {
      "proposalId": "uuid",
      "rank": 1,
      "score": 92,
      "recommendation": "Altamente Recomendado",
      "strengths": ["ponto forte 1", "ponto forte 2"],
      "considerations": ["ponto a considerar"],
      "matchReason": "Explicação breve do match"
    }
  ],
  "summary": "Análise geral das propostas recebidas",
  "topPick": {
    "proposalId": "uuid",
    "reason": "Por que este é o melhor candidato"
  }
}

DADOS DO PROJETO:
Título: ${project.title}
Descrição: ${project.description || "Não especificada"}
Categoria: ${project.category || "Geral"}
Orçamento: ${project.budget_min && project.budget_max 
  ? `${project.budget_min} - ${project.budget_max} ${project.currency}` 
  : "Não especificado"}

PROPOSTAS RECEBIDAS (${enrichedProposals.length}):
${JSON.stringify(enrichedProposals, null, 2)}

Analise e retorne APENAS o JSON válido, sem markdown ou explicações adicionais.
Responda em ${language === "pt" ? "português" : "inglês"}.`;

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
          { role: "user", content: "Analise as propostas e gere o ranking." },
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
    let analysisContent = aiData.choices?.[0]?.message?.content || "{}";

    // Clean markdown if present
    analysisContent = analysisContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch {
      console.error("Failed to parse AI response:", analysisContent);
      analysis = {
        rankings: [],
        summary: "Erro ao processar análise. Tente novamente.",
        topPick: null,
      };
    }

    // Log usage
    await supabase.from("genius_usage_log").insert({
      user_id: user.id,
      user_type: "company",
      feature_type: "ranking_ai",
      project_id: projectId,
      input_tokens: aiData.usage?.prompt_tokens || 0,
      output_tokens: aiData.usage?.completion_tokens || 0,
      model_used: "gemini-3-flash-preview",
    });

    return new Response(
      JSON.stringify({
        ...analysis,
        generatedAt: new Date().toISOString(),
        proposalsAnalyzed: enrichedProposals.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Genius ranking error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
