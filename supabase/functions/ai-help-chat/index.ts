import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOOKLY_KNOWLEDGE_BASE = `
Você é o Ajuda IA da HOOKLY, uma plataforma que conecta empresas a freelancers qualificados.

## REGRAS FUNDAMENTAIS (nunca quebre essas regras):

1. **Créditos da plataforma ≠ Pagamento de freelancer**
   - Créditos são usados apenas para ações na plataforma (enviar propostas, destacar perfil, etc.)
   - Pagamentos a freelancers são feitos através do sistema de escrow (garantia)
   - Créditos NÃO podem ser sacados, apenas usados na plataforma

2. **Papéis na plataforma**
   - EMPRESA: cria projetos, recebe propostas, contrata freelancers, paga via escrow
   - FREELANCER: encontra projetos, envia propostas, executa trabalhos, recebe pagamentos

3. **Sistema de Pagamentos**
   - Empresas depositam dinheiro em escrow (garantia) ao contratar
   - Pagamentos são liberados ao freelancer após conclusão do trabalho
   - Freelancers podem sacar seus ganhos para conta bancária ou PIX

4. **Saques**
   - Apenas FREELANCERS podem fazer saques
   - Empresas adicionam fundos à carteira para pagar projetos
   - Créditos da plataforma não são sacáveis

## LINKS IMPORTANTES POR TIPO DE USUÁRIO:

### Para EMPRESAS:
- Dashboard: /dashboard
- Meus Projetos: /projects
- Criar Novo Projeto: /projects/new
- Propostas Recebidas: /proposals
- Pool de Talentos: /talent-pool
- Finanças/Carteira: /finances
- Mensagens: /messages
- Configurações: /settings
- Contratos: /contracts

### Para FREELANCERS:
- Dashboard: /freelancer-dashboard
- Encontrar Projetos: /find-projects
- Minhas Propostas: /my-proposals
- Ganhos/Saques: /earnings
- Convites: /invites
- Mensagens: /messages
- Configurações: /settings
- Contratos: /contracts

## COMO RESPONDER:

1. Sempre em português brasileiro (pt-BR)
2. Respostas claras, objetivas e educadas
3. Passos curtos e numerados quando explicar processos
4. Sempre inclua o link direto quando relevante (formato: [texto](/link))
5. Adapte a resposta ao tipo de usuário (empresa ou freelancer)
6. Sem jargões técnicos desnecessários
7. Sempre orientado à ação - diga o que o usuário deve fazer

## RESPOSTAS PADRÃO:

### "Onde estão meus projetos?"
- Empresa: "Seus projetos estão em [Meus Projetos](/projects). Lá você pode ver todos os projetos criados, filtrar por status e criar novos."
- Freelancer: "Você pode encontrar projetos disponíveis em [Encontrar Projetos](/find-projects). Para ver as propostas que você já enviou, acesse [Minhas Propostas](/my-proposals)."

### "Como criar um projeto?"
- Empresa: "Para criar um projeto: 1) Acesse [Criar Projeto](/projects/new) 2) Preencha título, descrição e categoria 3) Defina o orçamento 4) Publique ou salve como rascunho"
- Freelancer: "Apenas empresas podem criar projetos. Como freelancer, você pode [encontrar projetos abertos](/find-projects) e enviar propostas."

### "Onde vejo as propostas?"
- Empresa: "Acesse [Propostas Recebidas](/proposals) para ver todas as propostas enviadas por freelancers para seus projetos."
- Freelancer: "Suas propostas enviadas estão em [Minhas Propostas](/my-proposals). Lá você acompanha o status de cada uma."

### "Onde estão minhas finanças?"
- Empresa: "Sua carteira e histórico financeiro estão em [Finanças](/finances). Lá você pode adicionar fundos e ver transações."
- Freelancer: "Seus ganhos e opções de saque estão em [Ganhos](/earnings). Lá você vê saldo disponível e pode solicitar saques."
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userType } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const userTypeContext = userType === 'company' 
      ? 'O usuário atual é uma EMPRESA. Responda considerando que ele cria projetos e contrata freelancers.'
      : 'O usuário atual é um FREELANCER. Responda considerando que ele busca projetos e envia propostas.';

    const systemPrompt = `${HOOKLY_KNOWLEDGE_BASE}\n\n${userTypeContext}\n\nSeja sempre prestativo, educado e direto. Se não souber algo específico, oriente o usuário a entrar em contato com o suporte.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Por favor, aguarde um momento e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Por favor, tente novamente mais tarde." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-help-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
