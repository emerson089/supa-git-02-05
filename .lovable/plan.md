

## Dois ajustes no Historico de Movimentacoes

### 1. Remover duplicacao "Inicio -> Corte" e "Lote Criado - Etapa inicial: Corte"

O log inicial (processo_anterior: null, processo_novo: 'Corte') e o evento "Lote Criado" mostram a mesma informacao. A solucao e filtrar o log inicial da timeline e manter apenas o evento "Lote Criado" (que ja exibe o cortador).

**Arquivo:** `src/components/production/HistoricoProducaoModal.tsx`
- Na renderizacao dos logs (linha 161), filtrar logs onde `!log.processo_anterior && log.processo_novo === 'Corte'` para nao renderizar na timeline
- Manter a busca desse log para extrair o nome do cortador no evento "Lote Criado"

### 2. Scroll do mouse nao funciona no modal

O `ScrollArea` do Radix bloqueia o scroll nativo do mouse dentro de modais Dialog. A solucao e adicionar `onWheel` com `stopPropagation` no viewport do ScrollArea, e garantir que o container tenha `overflow-y-auto` como fallback.

**Arquivo:** `src/components/production/HistoricoProducaoModal.tsx`
- Substituir `ScrollArea` por uma `div` com `overflow-y-auto` no container da timeline, que funciona de forma mais confiavel dentro de modais Dialog/Drawer

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/production/HistoricoProducaoModal.tsx` | Filtrar log inicial duplicado; corrigir scroll |

