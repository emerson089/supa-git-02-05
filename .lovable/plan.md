

## Evolucao do Dashboard: Insights Automaticos + Contexto Sazonal

### Visao Geral

Adicionar uma camada de interpretacao automatica dos dados do dashboard, gerando insights acionaveis e contexto historico sem alterar nenhum calculo, query, layout base ou performance existente.

### Arquitetura da Solucao

A logica de insights sera 100% derivada dos dados ja existentes no `useDashboardData`. Nenhuma query nova sera adicionada ao banco -- os insights sao calculados no frontend a partir dos dados que ja foram carregados.

```text
useDashboardData (existente, sem alteracoes)
        |
        v
useInsightsDashboard (NOVO hook)
  - Recebe: data, periodo, holidayMap
  - Calcula: insights automaticos + contexto sazonal
  - Retorna: lista de InsightItem[]
        |
        v
InsightsPanel (NOVO componente)
  - Renderiza bloco "Insights do Periodo"
  - Exibe frases curtas e acionaveis
  - Collapsible: expandido por padrao, pode recolher
```

### Arquivos Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/hooks/useInsightsDashboard.ts` | Hook que gera insights automaticos a partir dos dados do dashboard. Puro calculo, sem side effects, sem queries adicionais. |
| `src/components/dashboard/InsightsPanel.tsx` | Componente visual do bloco "Insights do Periodo". Card collapsible, discreto, abaixo dos KPIs e acima do grid principal. |

### Arquivo Modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/Dashboard.tsx` | Importar `useInsightsDashboard` e `InsightsPanel`. Inserir o componente entre os KPI cards (linha ~723) e o grid principal (linha ~726). Passar dados existentes como props. Nenhum calculo alterado. |

### 1) Insights Automaticos -- Logica do Hook

O hook `useInsightsDashboard` recebera os dados ja calculados e gerara frases interpretativas:

**Regras de geracao de insights (em ordem de prioridade):**

1. **Ritmo vs Meta** (usa `metaAutomatica`):
   - Se `statusMeta === 'abaixo'` e `diferencaRitmo < -10`: "Faturamento significativamente abaixo do ritmo sazonal (-Xpp). Queda pode estar concentrada nos ultimos dias."
   - Se `statusMeta === 'acima'`: "Faturamento acima do ritmo esperado (+Xpp). Projecao de R$ X para o mes."
   - Se `statusMeta === 'atingida'`: "Meta mensal atingida! Faturamento atual: R$ X."

2. **Estoque critico impactando vendas** (usa `estoqueBaixo` + `topModelos`):
   - Cruzar nomes dos top modelos com itens de estoque zerado/negativo. Se houver match: "Modelo 'X' esta entre os mais vendidos mas com estoque zerado. Pode estar perdendo vendas."

3. **Concentracao de vendas** (usa `faturamentoDiaSemana`):
   - Se um dia concentra mais de 40% do faturamento: "X% do faturamento esta concentrado em [dia]. Considere acoes para distribuir vendas."

4. **Tendencia de queda** (usa `tendenciaVendas`):
   - Se os ultimos 3 pontos da tendencia mostram queda consecutiva: "Queda consecutiva de faturamento nos ultimos [3 dias/semanas]. Verifique possiveis causas."

5. **Pedidos pendentes acumulados** (usa `kpis.pedidosPendentes`):
   - Se pedidos pendentes > 10: "Existem X pedidos pendentes de pagamento no periodo. Considere acao de cobranca."

6. **Comparacao YoY** (usa `kpis.faturamento` vs `kpis.faturamentoYoY`):
   - Se variacao < -20%: "Faturamento X% abaixo do mesmo periodo de [ano]. Verifique se ha fatores sazonais."
   - Se variacao > 20%: "Crescimento de X% vs mesmo periodo de [ano]."

7. **Sem anomalias**: Se nenhum insight relevante for gerado, exibir: "Desempenho dentro do esperado para o periodo analisado."

**Interface do insight:**
```typescript
interface InsightItem {
  id: string;
  tipo: 'alerta' | 'positivo' | 'info' | 'neutro';
  mensagem: string;
  icone: 'trending-down' | 'trending-up' | 'alert' | 'package' | 'check';
}
```

Limite maximo: 4 insights por vez (os mais relevantes).

### 2) Contexto de Sazonalidade

O mesmo hook gerara insights de contexto sazonal automaticamente:

1. **Comparacao com mes anterior** (usa variacao YoY ja calculada nos KPIs):
   - "Comparado ao mesmo periodo do mes anterior, faturamento [subiu/caiu] X%."

2. **Contexto historico do mes** (usa `metaAutomatica.faturamentosPorAno`):
   - Se ha dados sazonais: "Historicamente, [mes] teve faturamento medio de R$ X nos ultimos Y anos."

3. **Feriados no periodo** (usa `holidayMap` ja disponivel):
   - Se ha feriados nacionais no periodo selecionado: "Periodo inclui [feriado1, feriado2]. Isso pode impactar o volume de vendas."
   - Verificar quais datas do periodo selecionado possuem feriados e listar os nomes.

### 3) Componente Visual -- InsightsPanel

**Design (nao invasivo):**
- Card com titulo "Insights do Periodo" e icone de lampada (Lightbulb do lucide)
- Collapsible via `@radix-ui/react-collapsible` (ja instalado)
- Estado aberto/fechado persistido no localStorage
- Cada insight e uma linha com icone colorido + texto
- Cores: alerta (amber), positivo (emerald), info (blue), neutro (gray)
- Maximo 4 insights visiveis, sem scroll

**Posicionamento:** Entre os KPI cards e o grid "Tendencia de Vendas + Estoque Critico", mantendo a hierarquia visual existente.

**Mobile:** Stack vertical, mesma logica, sem alteracao de layout.

### 4) UX Consistente

- Filtros ja persistem no localStorage (implementado)
- DatePicker ja mantem range (corrigido anteriormente com `defaultMonth`)
- Feriados ja marcados no calendario (implementado)
- Nenhum elemento visual muda de posicao
- Insights aparecem apenas quando ha dados relevantes
- Estado vazio: "Desempenho dentro do esperado para o periodo analisado."

### Detalhes Tecnicos

**Performance:**
- `useInsightsDashboard` usa `useMemo` para recalcular insights apenas quando `data` muda
- Nenhuma query adicional ao banco
- Componente `InsightsPanel` e leve (apenas texto + icones)

**Nenhuma alteracao em:**
- `useDashboardData.ts` (nenhuma query, calculo ou interface modificada)
- Layout grid existente
- Componentes de KPI, graficos, tabelas
- Logica de filtros, presets, excluirCancelados
- Edge functions existentes

**Dependencias:** Nenhuma nova. Usa apenas `lucide-react`, `@radix-ui/react-collapsible`, e componentes UI ja existentes.

