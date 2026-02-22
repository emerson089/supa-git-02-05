

## Resumo Executivo + Prioridade + Foco do Dia

### Visao Geral

Evoluir o bloco "Insights do Periodo" existente para incluir 3 novos elementos: um resumo executivo (1 frase), classificacao visual de prioridade nos insights, e uma sugestao de foco. Tudo derivado dos dados ja calculados, sem queries novas.

### Arquitetura

Nenhum arquivo novo. Apenas evolucao dos 2 arquivos existentes:

```text
useInsightsDashboard (evolucao)
  - Retorna: { insights, resumoExecutivo, sugestaoFoco }
      |
      v
InsightsPanel (evolucao)
  - Exibe resumo executivo acima dos insights
  - Badges de prioridade por insight
  - Sugestao de foco no topo (se houver critico)
```

### Arquivos Modificados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useInsightsDashboard.ts` | Adicionar campo `prioridade` ao InsightItem. Mudar retorno de InsightItem[] para objeto `{ insights, resumoExecutivo, sugestaoFoco }`. Ordenar insights por prioridade. Gerar resumo e sugestao automaticamente. |
| `src/components/dashboard/InsightsPanel.tsx` | Receber novo formato de props. Exibir resumo executivo, badges de prioridade, e sugestao de foco. |
| `src/pages/Dashboard.tsx` | Ajustar chamada para novo formato de retorno (desestruturar objeto em vez de array). |

### 1) Mudancas no Hook (`useInsightsDashboard.ts`)

**Nova interface:**

```typescript
export interface InsightItem {
  id: string;
  tipo: "alerta" | "positivo" | "info" | "neutro";
  prioridade: "critico" | "atencao" | "contexto"; // NOVO
  mensagem: string;
  icone: "trending-down" | "trending-up" | "alert" | "package" | "check";
}

export interface InsightsDashboardResult {
  insights: InsightItem[];
  resumoExecutivo: string;
  sugestaoFoco: string | null; // null = nada critico, nao exibir
}
```

**Mapeamento de prioridade (automatico, baseado no tipo + id):**

| Condicao | Prioridade |
|---|---|
| `tipo === "alerta"` | `critico` |
| `tipo === "positivo"` ou `tipo === "info"` com ids como `meta-abaixo-leve`, `concentracao-dia` | `atencao` |
| `tipo === "info"` (historico, feriados) ou `tipo === "neutro"` | `contexto` |

**Ordenacao:** insights serao ordenados por prioridade antes do slice(0, 4): critico primeiro, depois atencao, depois contexto.

**Resumo executivo (1 frase, gerado automaticamente):**

Logica baseada no estado predominante:
- Se meta atingida/acima: "Desempenho positivo no periodo -- faturamento acima do ritmo esperado."
- Se meta abaixo forte (>10pp): "Periodo com desempenho abaixo do esperado -- faturamento significativamente abaixo do ritmo sazonal."
- Se meta abaixo leve: "Desempenho levemente abaixo do ritmo esperado para o periodo."
- Se crescimento YoY >20%: "Periodo de crescimento -- faturamento acima do mesmo periodo do ano anterior."
- Se queda YoY >20%: "Atencao: faturamento em queda comparado ao mesmo periodo do ano anterior."
- Fallback: "Desempenho dentro do esperado para o periodo analisado."

**Sugestao de foco:**

Derivada do primeiro insight critico. Mapeamento por id do insight:
- `meta-abaixo`: "Prioridade: investigar a queda de faturamento em relacao ao ritmo sazonal."
- `estoque-top-zerado`: "Prioridade: repor estoque dos modelos mais vendidos para evitar perda de vendas."
- `tendencia-queda`: "Prioridade: entender a queda consecutiva dos ultimos periodos."
- `pendentes-alto`: "Prioridade: acionar cobranca dos pedidos pendentes acumulados."
- `yoy-queda`: "Prioridade: analisar os fatores da queda comparado ao ano anterior."
- Se nao houver insight critico: `null` (nao exibir).

### 2) Mudancas no Componente (`InsightsPanel.tsx`)

**Props atualizadas:**

```typescript
interface InsightsPanelProps {
  insights: InsightItem[];
  resumoExecutivo: string;
  sugestaoFoco: string | null;
}
```

**Layout (dentro do mesmo Card collapsible):**

```text
+---------------------------------------------------+
| [lampada] Insights do Periodo (N)          [v]    |
+---------------------------------------------------+
| Resumo: "Periodo com desempenho abaixo..."        |  <- 1 linha, texto cinza, discreto
|                                                   |
| [alvo] Prioridade: investigar a queda...          |  <- sugestao de foco, destaque sutil
|                                                   |
| [vermelho] Faturamento abaixo do ritmo...         |  <- badge "Critico"
| [amarelo] Estoque zerado impactando...            |  <- badge "Atencao"  
| [azul] Historicamente, fevereiro...               |  <- badge "Contexto"
+---------------------------------------------------+
```

**Badges de prioridade (apenas visual):**

| Prioridade | Cor | Label |
|---|---|---|
| `critico` | vermelho (`text-red-600`, `bg-red-100`) | "Critico" |
| `atencao` | amarelo (`text-amber-600`, `bg-amber-100`) | "Atencao" |
| `contexto` | azul (`text-blue-600`, `bg-blue-100`) | "Contexto" |

Cada badge e um pequeno chip ao lado do icone do insight, sem alterar o layout existente das linhas.

**Sugestao de foco:**
- Exibida apenas quando `sugestaoFoco !== null`
- Icone `Target` do lucide-react
- Fundo levemente destacado (`bg-primary/5 border border-primary/20`)
- Texto em `text-sm font-medium`

**Resumo executivo:**
- 1 linha de texto acima dos insights
- Cor `text-muted-foreground`, tamanho `text-sm`
- Sem icone, sem destaque forte

### 3) Mudanca no Dashboard (`Dashboard.tsx`)

Apenas ajustar a desestruturacao:

```typescript
// Antes:
const dashboardInsights = useInsightsDashboard({...});
<InsightsPanel insights={dashboardInsights} />

// Depois:
const { insights: dashboardInsights, resumoExecutivo, sugestaoFoco } = useInsightsDashboard({...});
<InsightsPanel insights={dashboardInsights} resumoExecutivo={resumoExecutivo} sugestaoFoco={sugestaoFoco} />
```

### O que NAO muda

- Nenhuma query ou calculo de dados
- Nenhum KPI muda de valor
- Layout grid, filtros, presets -- tudo inalterado
- Limite de 4 insights mantido
- Estado collapsible com localStorage mantido
- Performance: apenas logica adicional no useMemo existente (custo zero)
- Nenhuma dependencia nova

