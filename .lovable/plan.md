

## Plano: Evoluir Dashboard com Inteligência de Vendas

### Objetivo
Adicionar recursos de inteligência de vendas ao Dashboard para apoiar decisões sobre produção, campanhas e logística. Todas as métricas usam **exclusivamente pedidos com status_pagamento = "PAGO"**.

---

## Novos Recursos

### 1. KPI "Previsão Mensal"
**Fórmula:** `(faturamento atual do mês / dias decorridos) × total de dias do mês`

- Exibe projeção de quanto o mês pode faturar se mantiver o ritmo atual
- Mostra se está acima ou abaixo da meta YoY
- Localização: Novo card ao lado da Meta Mensal (ou dentro dela)

**Exemplo visual:**
```
┌─────────────────────────────────┐
│ 📊 Previsão Mensal              │
│ R$ 145.320,00                   │
│ ↑ 12% vs. meta (+R$ 15.320)     │
│ Ritmo: R$ 4.691/dia             │
└─────────────────────────────────┘
```

---

### 2. Meta Mensal Automática
**Fórmula:** `média últimos 3 meses pagos × (1 + % configurável)`

- Substitui o cálculo atual de "ano passado + 15%"
- Permite fallback para meta manual quando não há histórico
- Adiciona configuração de % de crescimento (default: 10%)
- Armazena configuração no localStorage ou em tabela de configs

**Fluxo:**
1. Buscar faturamento dos últimos 3 meses completos (apenas PAGO)
2. Calcular média: `(mes1 + mes2 + mes3) / 3`
3. Aplicar crescimento: `média × 1.10` (ou % configurado)
4. Exibir no card de Meta Mensal

---

### 3. Gráfico "Faturamento por Dia da Semana"
**Dados:** Pedidos PAGO agrupados por dia da semana (Segunda a Sábado)

- Novo card no Dashboard com BarChart horizontal ou vertical
- Mostra qual dia da semana vende mais/menos
- Usa `paid_at` para agrupamento (fallback para `created_at`)
- Útil para: planejamento de campanhas, escala de equipe, produção

**Visualização:**
```
Segunda  ████████████ R$ 25.400
Terça    ██████████   R$ 20.100
Quarta   ████████     R$ 16.800
Quinta   ██████████████ R$ 28.500
Sexta    ████████████████ R$ 32.000
Sábado   ██████       R$ 12.200
```

---

## Alterações Técnicas

### Arquivo 1: `src/hooks/useDashboardData.ts`

#### 1.1 Adicionar tipos para novos dados
```typescript
export interface PrevisaoMensal {
  projecaoMensal: number;        // Faturamento projetado para o mês
  mediaDiaria: number;           // Média diária atual
  diasDecorridos: number;        // Dias do início do mês até hoje
  diasTotais: number;            // Total de dias do mês
  variacaoVsMeta: number;        // % acima/abaixo da meta
  acimaOuAbaixo: 'acima' | 'abaixo' | 'igual';
}

export interface MetaAutomatica {
  media3Meses: number;           // Média faturamento últimos 3 meses
  percentualCrescimento: number; // % de crescimento (default 10)
  metaCalculada: number;         // Média × (1 + %)
  mesesUsados: string[];         // Lista de meses usados no cálculo
  temHistorico: boolean;         // Se há dados suficientes
}

export interface FaturamentoDiaSemana {
  diaSemana: string;             // Segunda, Terça, etc.
  diaSemanaIndex: number;        // 0=Dom, 1=Seg, ..., 6=Sáb
  valor: number;                 // Total faturado
  pedidos: number;               // Quantidade de pedidos
  pecas: number;                 // Total de peças
  percentual: number;            // % do total
}
```

#### 1.2 Atualizar interface DashboardData
```typescript
interface DashboardData {
  // ... campos existentes ...
  previsaoMensal: PrevisaoMensal;
  metaAutomatica: MetaAutomatica;
  faturamentoDiaSemana: FaturamentoDiaSemana[];
}
```

#### 1.3 Adicionar queries para últimos 3 meses
```typescript
// Dentro de Promise.all, adicionar:

// Faturamento dos últimos 3 meses (para média automática)
const mes1Inicio = startOfMonth(subMonths(now, 1));
const mes1Fim = endOfMonth(subMonths(now, 1));
const mes2Inicio = startOfMonth(subMonths(now, 2));
const mes2Fim = endOfMonth(subMonths(now, 2));
const mes3Inicio = startOfMonth(subMonths(now, 3));
const mes3Fim = endOfMonth(subMonths(now, 3));

const [faturamentoMes1, faturamentoMes2, faturamentoMes3] = await Promise.all([
  supabase.from("pedidos")
    .select("valor_total")
    .eq("user_id", user.id)
    .eq("status_pagamento", "PAGO")
    .gte("paid_at", mes1Inicio.toISOString())
    .lte("paid_at", mes1Fim.toISOString()),
  supabase.from("pedidos")
    .select("valor_total")
    .eq("user_id", user.id)
    .eq("status_pagamento", "PAGO")
    .gte("paid_at", mes2Inicio.toISOString())
    .lte("paid_at", mes2Fim.toISOString()),
  supabase.from("pedidos")
    .select("valor_total")
    .eq("user_id", user.id)
    .eq("status_pagamento", "PAGO")
    .gte("paid_at", mes3Inicio.toISOString())
    .lte("paid_at", mes3Fim.toISOString()),
]);
```

#### 1.4 Calcular previsão mensal
```typescript
// Após obter faturamento do mês atual
const diasDecorridos = getDate(now); // Dia do mês (1-31)
const diasTotais = getDaysInMonth(now);
const mediaDiaria = diasDecorridos > 0 
  ? faturamentoAtualAcumulado / diasDecorridos 
  : 0;
const projecaoMensal = mediaDiaria * diasTotais;

const previsaoMensal: PrevisaoMensal = {
  projecaoMensal,
  mediaDiaria,
  diasDecorridos,
  diasTotais,
  variacaoVsMeta: metaAutomatica.metaCalculada > 0 
    ? ((projecaoMensal - metaAutomatica.metaCalculada) / metaAutomatica.metaCalculada) * 100 
    : 0,
  acimaOuAbaixo: projecaoMensal > metaAutomatica.metaCalculada 
    ? 'acima' 
    : projecaoMensal < metaAutomatica.metaCalculada 
      ? 'abaixo' 
      : 'igual',
};
```

#### 1.5 Calcular meta automática
```typescript
const somaMeses = [
  (faturamentoMes1.data || []).reduce((s, p) => s + (p.valor_total || 0), 0),
  (faturamentoMes2.data || []).reduce((s, p) => s + (p.valor_total || 0), 0),
  (faturamentoMes3.data || []).reduce((s, p) => s + (p.valor_total || 0), 0),
];

const mesesComDados = somaMeses.filter(v => v > 0);
const media3Meses = mesesComDados.length > 0 
  ? mesesComDados.reduce((a, b) => a + b, 0) / mesesComDados.length 
  : 0;

const percentualCrescimento = 0.10; // 10% default, pode vir do localStorage
const metaCalculada = media3Meses * (1 + percentualCrescimento);

const metaAutomatica: MetaAutomatica = {
  media3Meses,
  percentualCrescimento: percentualCrescimento * 100,
  metaCalculada,
  mesesUsados: [
    format(subMonths(now, 1), "MMM/yy", { locale: ptBR }),
    format(subMonths(now, 2), "MMM/yy", { locale: ptBR }),
    format(subMonths(now, 3), "MMM/yy", { locale: ptBR }),
  ],
  temHistorico: mesesComDados.length >= 2,
};
```

#### 1.6 Calcular faturamento por dia da semana
```typescript
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Usar pedidos do mês atual (ou período selecionado)
const diaSemanaMap: Record<number, { valor: number; pedidos: number; pecas: number }> = {
  0: { valor: 0, pedidos: 0, pecas: 0 }, // Domingo
  1: { valor: 0, pedidos: 0, pecas: 0 }, // Segunda
  2: { valor: 0, pedidos: 0, pecas: 0 }, // Terça
  3: { valor: 0, pedidos: 0, pecas: 0 }, // Quarta
  4: { valor: 0, pedidos: 0, pecas: 0 }, // Quinta
  5: { valor: 0, pedidos: 0, pecas: 0 }, // Sexta
  6: { valor: 0, pedidos: 0, pecas: 0 }, // Sábado
};

pedidosPagos.forEach(p => {
  const dataEfetiva = p.paid_at || p.created_at;
  const dia = getDay(parseISO(dataEfetiva)); // 0-6
  diaSemanaMap[dia].valor += p.valor_total || 0;
  diaSemanaMap[dia].pedidos += 1;
  diaSemanaMap[dia].pecas += p.total_pecas || 0;
});

const totalValor = Object.values(diaSemanaMap).reduce((s, d) => s + d.valor, 0);

// Filtrar apenas Segunda a Sábado (1-6), excluir Domingo por padrão
const faturamentoDiaSemana: FaturamentoDiaSemana[] = [1, 2, 3, 4, 5, 6]
  .map(i => ({
    diaSemana: DIAS_SEMANA[i],
    diaSemanaIndex: i,
    valor: diaSemanaMap[i].valor,
    pedidos: diaSemanaMap[i].pedidos,
    pecas: diaSemanaMap[i].pecas,
    percentual: totalValor > 0 ? (diaSemanaMap[i].valor / totalValor) * 100 : 0,
  }))
  .sort((a, b) => b.valor - a.valor); // Ordenar por maior valor
```

---

### Arquivo 2: `src/pages/Dashboard.tsx`

#### 2.1 Modificar Card de Meta Mensal
Substituir a exibição atual para usar `metaAutomatica` como base:

```tsx
{/* Meta + Previsão - Card Combinado */}
<Card className="neu-card border-primary/20 shadow-lg bg-gradient-to-br from-card to-primary/5">
  <CardContent className="p-4 sm:p-6">
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
      {/* Meta Automática */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Target size={18} className="text-primary" />
          <h3 className="text-sm font-semibold">Meta Mensal</h3>
          <Badge variant="secondary" className="text-[10px]">
            Média 3m + {data.metaAutomatica.percentualCrescimento}%
          </Badge>
        </div>
        <p className="text-2xl font-bold text-foreground">
          {formatCurrency(data.metaAutomatica.metaCalculada)}
        </p>
        <p className="text-xs text-muted-foreground">
          Base: {data.metaAutomatica.mesesUsados.join(', ')}
        </p>
      </div>

      {/* Previsão Mensal */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={18} className="text-emerald-500" />
          <h3 className="text-sm font-semibold">Previsão Mensal</h3>
        </div>
        <p className={cn(
          "text-2xl font-bold",
          data.previsaoMensal.acimaOuAbaixo === 'acima' ? "text-emerald-600" : "text-amber-600"
        )}>
          {formatCurrency(data.previsaoMensal.projecaoMensal)}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            Ritmo: {formatCurrency(data.previsaoMensal.mediaDiaria)}/dia
          </span>
          <span className={cn(
            "font-semibold",
            data.previsaoMensal.acimaOuAbaixo === 'acima' ? "text-emerald-600" : "text-amber-600"
          )}>
            {data.previsaoMensal.variacaoVsMeta > 0 ? '+' : ''}
            {data.previsaoMensal.variacaoVsMeta.toFixed(1)}% vs. meta
          </span>
        </div>
      </div>
    </div>
    
    {/* Barra de progresso - Faturado vs Meta */}
    <Progress 
      value={Math.min((data.metaYoY.faturamentoAtualAcumulado / data.metaAutomatica.metaCalculada) * 100, 100)} 
      className="h-2 mt-4"
    />
    <p className="text-xs text-muted-foreground mt-1">
      {formatCurrency(data.metaYoY.faturamentoAtualAcumulado)} de {formatCurrency(data.metaAutomatica.metaCalculada)} 
      ({((data.metaYoY.faturamentoAtualAcumulado / data.metaAutomatica.metaCalculada) * 100).toFixed(1)}%)
    </p>
  </CardContent>
</Card>
```

#### 2.2 Adicionar novo card "Faturamento por Dia da Semana"
Inserir na grid inferior, substituindo ou ao lado de outro card:

```tsx
{/* Faturamento por Dia da Semana */}
<Card className="neu-card">
  <CardHeader className="pb-2">
    <div className="flex items-center gap-2">
      <CalendarIcon size={18} className="text-primary" />
      <CardTitle className="text-base font-semibold">Vendas por Dia</CardTitle>
    </div>
    <p className="text-sm text-muted-foreground">
      Faturamento por dia da semana (pedidos pagos)
    </p>
  </CardHeader>
  <CardContent>
    {loading ? (
      <Skeleton className="h-[180px] w-full" />
    ) : (
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data.faturamentoDiaSemana} 
            layout="vertical"
            margin={{ left: 0, right: 10 }}
          >
            <XAxis 
              type="number" 
              tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
              fontSize={10}
            />
            <YAxis 
              dataKey="diaSemana" 
              type="category" 
              width={60}
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
              labelFormatter={(label) => label}
            />
            <Bar 
              dataKey="valor" 
              fill="hsl(var(--primary))" 
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </CardContent>
</Card>
```

#### 2.3 Adicionar import do BarChart
```tsx
import {
  AreaChart,
  Area,
  BarChart,  // ← Novo
  Bar,       // ← Novo
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
```

---

## Configuração do % de Crescimento (Opcional)

Para permitir que o usuário configure o percentual:

```tsx
// No card de Meta, adicionar botão de edição
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
      <Pencil size={12} />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-48">
    <div className="space-y-2">
      <Label>Crescimento (%)</Label>
      <Input 
        type="number" 
        value={percentualCrescimento} 
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          localStorage.setItem('dashboard-meta-crescimento', val.toString());
          // Atualizar estado
        }}
      />
    </div>
  </PopoverContent>
</Popover>
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Adicionar tipos e cálculos para previsão, meta automática e faturamento por dia |
| `src/pages/Dashboard.tsx` | Atualizar card de meta, adicionar card de vendas por dia da semana |

---

## Valor de Negócio

| Recurso | Decisão Suportada |
|---------|-------------------|
| Previsão Mensal | Ajustar metas de produção, antecipar necessidade de estoque |
| Meta Automática | Metas realistas baseadas em histórico recente |
| Vendas por Dia | Planejamento de campanhas, escala de equipe, produção semanal |

---

## Critérios de Aceite

| Cenário | Resultado |
|---------|-----------|
| Dashboard carrega | Previsão e meta automática exibidos |
| Período = "Mês" | Gráfico por dia da semana mostra dados do mês |
| Nenhum pedido PAGO | Cards mostram R$ 0,00 sem erros |
| Configurar % crescimento | Meta recalcula automaticamente |

