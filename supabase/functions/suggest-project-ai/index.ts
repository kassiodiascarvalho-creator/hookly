import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BudgetRequest {
  type: 'budget';
  title: string;
  description: string;
  category: string;
  currency: string;
}

interface KpiRequest {
  type: 'kpis';
  title: string;
  description: string;
  category: string;
}

type RequestBody = BudgetRequest | KpiRequest;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    let tools: any[];
    let toolChoice: any;

    if (body.type === 'budget') {
      const { title, description, category, currency } = body as BudgetRequest;
      
      systemPrompt = `You are a market analysis expert for freelance projects. You analyze project descriptions and provide realistic budget estimates based on:
- Project complexity and scope
- Required skills and expertise level
- Typical market rates for similar projects
- Time and effort required

Always provide estimates in the specified currency. Be realistic and helpful.`;

      userPrompt = `Analyze this project and suggest a budget range:

Title: ${title}
Category: ${category}
Currency: ${currency}
Description: ${description}

Based on market rates and project complexity, provide minimum, average, and maximum budget recommendations.`;

      tools = [
        {
          type: "function",
          function: {
            name: "suggest_budget",
            description: "Return budget suggestions for the project",
            parameters: {
              type: "object",
              properties: {
                min_budget: {
                  type: "number",
                  description: "Minimum recommended budget"
                },
                avg_budget: {
                  type: "number",
                  description: "Average market budget"
                },
                max_budget: {
                  type: "number",
                  description: "Maximum recommended budget"
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation of the analysis (max 100 words)"
                },
                complexity: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Estimated project complexity"
                }
              },
              required: ["min_budget", "avg_budget", "max_budget", "reasoning", "complexity"],
              additionalProperties: false
            }
          }
        }
      ];
      toolChoice = { type: "function", function: { name: "suggest_budget" } };

    } else if (body.type === 'kpis') {
      const { title, description, category } = body as KpiRequest;
      
      systemPrompt = `You are an expert in project management and performance metrics. You help companies define clear, measurable KPIs (Key Performance Indicators) for freelance projects.

Your KPIs should be:
- Specific and measurable
- Realistic and achievable
- Relevant to the project type
- Time-bound when applicable

Always respond in Portuguese (Brazilian).`;

      userPrompt = `Suggest 3-5 relevant KPIs for this project:

Title: ${title}
Category: ${category}
Description: ${description}

Generate practical, measurable KPIs that will help evaluate the success of this project.`;

      tools = [
        {
          type: "function",
          function: {
            name: "suggest_kpis",
            description: "Return KPI suggestions for the project",
            parameters: {
              type: "object",
              properties: {
                kpis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Name of the KPI in Portuguese"
                      },
                      target: {
                        type: "string",
                        description: "Measurable target/goal in Portuguese"
                      },
                      example: {
                        type: "string",
                        description: "Brief example or explanation in Portuguese"
                      }
                    },
                    required: ["name", "target", "example"],
                    additionalProperties: false
                  },
                  minItems: 3,
                  maxItems: 5
                }
              },
              required: ["kpis"],
              additionalProperties: false
            }
          }
        }
      ];
      toolChoice = { type: "function", function: { name: "suggest_kpis" } };

    } else {
      throw new Error("Invalid request type");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("suggest-project-ai error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
