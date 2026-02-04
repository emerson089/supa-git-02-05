
## Plano: Corrigir Card de Produção no Dashboard

### Problemas Identificados

#### 1. Filtro de Período Incorreto (Principal)
A query de produção no Dashboard filtra por `created_date`:
```typescript
.gte("created_date", startDate)
.lte("created_date", endDate)
```

**Resultado**: Mostra apenas lotes **criados** no período selecionado (8 peças em fevereiro), quando deveria mostrar **todos os lotes ativos** (1.999 peças em 5 etapas).

| Estado | Lotes | Peças |
|--------|-------|-------|
| Mostrado | 1 | 8 |
| Real | 13 | 1.999 |

#### 2. Etapas Desatualizadas
O mapeamento no Dashboard (`ETAPA_ORDER` e `ETAPA_COLORS`) está incompleto:

| Etapas no Banco | ETAPA_ORDER | Status |
|-----------------|-------------|--------|
| Corte | Corte | OK |
| Costura/Facção | Costura/Facção | OK |
| **Travete** | - | Faltando |
| **Destroyed** | - | Faltando |
| Lavanderia | Lavanderia | OK |
| **Limpado** | - | Faltando |
| Aprontamento | Aprontamento | OK |
| **Vendas** | - | Faltando |
| - | Acabamento | Não existe |
| - | Concluído | Não existe |

#### 3. Cores Faltando
Etapas como `Travete`, `Destroyed`, `Limpado`, `Vendas` usam cor fallback (`muted`) em vez de cores distintas.

### Solução Proposta

#### 1. Remover Filtro de Período da Produção

**De:**
```typescript
// Produção atual (com filtro de período)
supabase
  .from("producao")
  .select("processo_atual, quantidade, created_date")
  .eq("user_id", user.id)
  .gte("created_date", startDate)
  .lte("created_date", endDate),
```

**Para:**
```typescript
// Produção atual (TODOS os lotes ativos)
supabase
  .from("producao")
  .select("processo_atual, quantidade")
  .eq("user_id", user.id),
```

Isso alinha o Dashboard com o comportamento do Kanban que já usa `useProducaoContagens` sem filtro de período.

#### 2. Atualizar Lista de Etapas

```typescript
const ETAPA_ORDER: string[] = [
  "Corte",
  "Costura/Facção",
  "Travete",
  "Destroyed",
  "Lavanderia",
  "Limpado",
  "Aprontamento",
  "Vendas",
];
```

#### 3. Adicionar Cores para Novas Etapas

```typescript
const ETAPA_COLORS: Record<string, string> = {
  "Corte": "hsl(var(--stage-corte))",
  "Costura/Facção": "hsl(var(--stage-costura))",
  "Travete": "#6366f1",           // Indigo
  "Destroyed": "#f97316",          // Orange
  "Lavanderia": "hsl(var(--stage-lavanderia))",
  "Limpado": "#14b8a6",            // Teal
  "Aprontamento": "hsl(var(--stage-acabamento))",
  "Vendas": "hsl(var(--stage-estoque))",
};
```

### Resultado Esperado

```text
┌─────────────────────────────────────────────┐
│ Produção                      Ver Kanban >  │
│ Peças por etapa                             │
├─────────────────────────────────────────────┤
│              1.999 peças                    │
│                                             │
│ ● Lavanderia                          708   │
│ ● Corte                               458   │
│ ● Aprontamento                        336   │
│ ● Vendas                              251   │
│ ● Costura/Facção                      246   │
└─────────────────────────────────────────────┘
```

### Detalhes Técnicos

#### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Remover filtro de período na query de produção; Atualizar `ETAPA_ORDER` e `ETAPA_COLORS` |

#### Impacto nos KPIs

O KPI "Produção Ativa" no cabeçalho também será afetado positivamente — mostrará o total real de peças em produção (1.999) em vez de apenas as do período.

#### Comparativo YoY

A query de comparação YoY para produção pode continuar com filtro de período para comparar produção **iniciada** no mesmo período do ano passado, se desejado. Mas o card de etapas mostrará sempre a situação atual real.
