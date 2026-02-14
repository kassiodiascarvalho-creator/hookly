

# Remover console.log tambem no ambiente de preview

## Problema
A configuracao atual so remove `console.log` no build de producao (`mode === "production"`). No ambiente de preview (desenvolvimento), os logs continuam aparecendo no console do navegador.

## Solucao
Remover a condicao de modo para que `console.log` e `debugger` sejam sempre removidos, independente do ambiente.

## Alteracao tecnica

### Arquivo: `vite.config.ts`
Mudar de:
```typescript
esbuild: {
  drop: mode === "production" ? ["console", "debugger"] : [],
  legalComments: "none",
},
```

Para:
```typescript
esbuild: {
  drop: ["console", "debugger"],
  legalComments: "none",
},
```

## Impacto
- Console do navegador ficara limpo em todos os ambientes (preview e producao)
- Nenhuma funcionalidade sera afetada -- os `console.log` sao apenas para debug
- Apenas 1 linha alterada em 1 arquivo

