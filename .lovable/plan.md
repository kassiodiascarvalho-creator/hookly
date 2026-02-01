
Objetivo
- Fazer o carrossel de logos carregar 100% (sem depender de serviços externos que falham/bloqueiam).
- Acelerar o movimento em 1 segundo (de 24s para 23s).

Diagnóstico (por que está falhando)
- As imagens atuais vêm de `https://logo.clearbit.com/...`.
- No preview, essas requisições estão falhando com erro de rede `net::ERR_TUNNEL_CONNECTION_FAILED` (isso costuma acontecer por bloqueio de rede/antitracker/adblock/VPN/proxy ou restrição do próprio serviço).
- Como é um `<img src="https://...">`, se o navegador bloquear a conexão, não tem “conserto” só com CSS/React: precisamos parar de depender dessas URLs externas.

Solução (garantir 100%)
1) Trocar todas as logos para arquivos locais (dentro do projeto)
- Adicionar as 11 logos dentro de `public/logos/companies/` (ex.: `meta.svg`, `alphabet.svg`, `coca-cola.svg`, etc).
- Vantagem: o navegador carrega do mesmo domínio do site, sem bloqueio de terceiros e sem “tunnel/proxy issues”.
- Fonte recomendada: SVGs oficiais ou de repositórios confiáveis (ex.: Simple Icons/brand assets) e manter arquivos otimizados (tamanho pequeno).

2) Atualizar o componente `CompanyLogosCarousel` para usar paths locais
- Trocar o array `COMPANY_LOGOS` para usar:
  - `/logos/companies/meta.svg`
  - `/logos/companies/alphabet.svg`
  - `/logos/companies/coca-cola.svg`
  - `/logos/companies/amazon.svg`
  - `/logos/companies/nvidia.svg`
  - `/logos/companies/apple.svg`
  - `/logos/companies/microsoft.svg`
  - `/logos/companies/ibm.svg`
  - `/logos/companies/adobe.svg`
  - `/logos/companies/google.svg`
  - `/logos/companies/tiktok.svg`

3) Ajustar o estilo para não “sumir” em dark mode
- Hoje o componente usa `dark:invert`. Em logos coloridas isso pode ficar estranho; em algumas combinações pode piorar contraste.
- Vamos alinhar com o carrossel de providers (Stripe/Mercado/Supabase) que funciona melhor:
  - Remover `dark:invert`
  - Manter algo como `dark:brightness-150` (e se necessário adicionar `dark:contrast-125`) para garantir legibilidade.

4) Adicionar fallback de carregamento (para “100%” visual)
Mesmo com assets locais, vale blindar:
- Adicionar `onError` no `<img>` para trocar automaticamente para um placeholder local (por ex. `/placeholder.svg`) caso algum arquivo esteja faltando ou corrompido.
- Importante: sem texto, só imagem placeholder discreta (ou até esconder o item).

5) Acelerar 1 segundo o movimento
- Em `CompanyLogosCarousel.tsx`, alterar:
  - `duration: 24` → `duration: 23`
- Mantemos `repeat: Infinity` e `ease: "linear"`.

Arquivos que serão mexidos/criados (quando eu implementar em modo de edição)
- Criar (novos arquivos estáticos):
  - `public/logos/companies/meta.svg`
  - `public/logos/companies/alphabet.svg`
  - `public/logos/companies/coca-cola.svg`
  - `public/logos/companies/amazon.svg`
  - `public/logos/companies/nvidia.svg`
  - `public/logos/companies/apple.svg`
  - `public/logos/companies/microsoft.svg`
  - `public/logos/companies/ibm.svg`
  - `public/logos/companies/adobe.svg`
  - `public/logos/companies/google.svg`
  - `public/logos/companies/tiktok.svg`
- Editar:
  - `src/components/landing/CompanyLogosCarousel.tsx` (paths locais, velocidade, fallback, ajustes de dark mode)

Critérios de aceite (como vamos validar que ficou “100%”)
- Na aba / home:
  - As 11 logos aparecem (sem ícones quebrados) em desktop e mobile.
  - Sem requisições para `logo.clearbit.com` no Network (zero dependência externa).
  - Carrossel continua com fade nas bordas (mask-gradient-x) e com loop suave.
  - Velocidade visivelmente 1 segundo mais rápida.
- Testar em:
  - Modo claro e modo escuro
  - Navegador com bloqueador/antitracker ligado (para confirmar que não afeta mais)

Riscos / observações
- Licenças de logos: vou usar assets conhecidos (SVG) e manter o uso apenas como “marcas exibidas” no site. Se você preferir, posso substituir por versões monocromáticas para consistência visual total.
