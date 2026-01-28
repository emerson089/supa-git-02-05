

## Plano: Meta e Ritmo com Sazonalidade do Setor de Moda

### Objetivo
Refinar o sistema de Meta Mensal e Ritmo do Dashboard para respeitar a sazonalidade do setor de moda/jeans, comparando com dados do **mesmo mês em anos anteriores** ao invés de usar média simples dos últimos 3 meses.

---

## Dados Históricos Disponíveis

A análise do banco confirmou dados robustos para cálculo sazonal:

| Mês | Jan/2025 | Jan/2026 | Dez/2024 | Dez/2025 |
|-----|----------|----------|----------|----------|
| **Faturamento** | R$ 231.253 | R$ 311.757 | R$ 412.603 | R$ 645.033 |
| **Pedidos Pagos** | 154 | 223 | 208 | 297 |

**Curva de Janeiro (histórica):**
- Até dia 10: ~30% acumulado
- Até dia 16: ~62% acumulado  
- Até dia 28: ~92% acumulado

Isso demonstra que as vendas não são lineares - há concentração em semanas específicas.

---

## Solução Proposta

### 1. Meta Mensal Sazonal

**Antes**: Média dos últimos 3 meses (out/nov/dez)  
**Depois**: Média do MESMO mês em anos anteriores + % crescimento

| Janeiro 2026 | Cálculo |
|--------------|---------|
| Jan/2025 | R$ 231.253 |
| Jan/2024 | (não disponível) |
| **Média** | R$ 231.253 |
| **Meta (+10%)** | R$ 254.378 |

### 2. Ritmo Sazonal (Curva não-linear)

**Antes**: % esperado = dia ÷ total_dias (linear)  
**Depois**: % esperado = curva histórica do mesmo mês

| Dia | % Esperado (Sazonal) | % Linear |
|-----|---------------------|----------|
| 10 | 30.7% | 32.3% |
| 16 | 62.6% | 51.6% |
| 28 | 92.2% | 90.3% |

### 3. Comparativo de Status

**Exemplo para dia 27 de janeiro:**
- Faturamento atual: R$ 311.757
- Meta sazonal: R$ 254.378
- % Realizado: 122.6%
- % Esperado (curva): ~89% 
- **Status**: ✅ Acima do ritmo sazonal (+33pp)

---

## Alterações Técnicas

### Nova Tabela: `curvas_mensais`

Armazena a curva percentual acumulada por dia do mês:

```sql
CREATE TABLE curvas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mes INTEGER NOT NULL,        -- 1-12
  dia INTEGER NOT NULL,        -- 1-31
  percentual_esperado NUMERIC NOT NULL,
  anos_considerados INTEGER DEFAULT 1,
  total_faturamento_base NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, mes, dia)
);

-- RLS
ALTER TABLE curvas_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own curvas" ON curvas_mensais
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Nova Função RPC: `get_media_mes_anos_anteriores`

Calcula a média do mesmo mês em todos os anos disponíveis:

```sql
CREATE OR REPLACE FUNCTION get_media_mes_anos_anteriores(
  p_user_id UUID,
  p_mes INTEGER,
  p_limite_anos INTEGER DEFAULT 5
) RETURNS TABLE (
  media_faturamento NUMERIC,
  anos_usados INTEGER[],
  faturamentos_por_ano JSONB
) AS $$
  WITH faturamentos AS (
    SELECT 
      EXTRACT(YEAR FROM created_at)::int as ano,
      SUM(valor_total) as faturamento
    FROM pedidos 
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
    GROUP BY EXTRACT(YEAR FROM created_at)
    ORDER BY ano DESC
    LIMIT p_limite_anos
  )
  SELECT 
    COALESCE(AVG(faturamento), 0)::numeric as media_faturamento,
    ARRAY_AGG(ano ORDER BY ano DESC)::integer[] as anos_usados,
    COALESCE(jsonb_object_agg(ano::text, faturamento), '{}'::jsonb) as faturamentos_por_ano
  FROM faturamentos;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
```

### Nova Função RPC: `get_curva_mes`

Calcula a curva percentual acumulada de um mês específico:

```sql
CREATE OR REPLACE FUNCTION get_curva_mes(
  p_user_id UUID,
  p_mes INTEGER
) RETURNS TABLE (
  dia INTEGER,
  percentual_acumulado NUMERIC,
  faturamento_acumulado NUMERIC
) AS $$
  WITH dados_diarios AS (
    SELECT 
      EXTRACT(DAY FROM created_at)::int as dia,
      SUM(valor_total) as fat_dia
    FROM pedidos 
    WHERE user_id = p_user_id
      AND status_pagamento = 'PAGO'
      AND EXTRACT(MONTH FROM created_at) = p_mes
      AND EXTRACT(YEAR FROM created_at) < EXTRACT(YEAR FROM NOW())
    GROUP BY EXTRACT(DAY FROM created_at)
  ),
  total AS (
    SELECT COALESCE(SUM(fat_dia), 0) as total_mes FROM dados_diarios
  ),
  acumulado AS (
    SELECT 
      d.dia,
      SUM(d.fat_dia) OVER (ORDER BY d.dia) as fat_acumulado,
      t.total_mes
    FROM dados_diarios d, total t
  )
  SELECT 
    a.dia,
    CASE WHEN a.total_mes > 0 
      THEN ROUND((a.fat_acumulado / a.total_mes * 100)::numeric, 2)
      ELSE (a.dia::numeric / 31 * 100)
    END as percentual_acumulado,
    a.fat_acumulado as faturamento_acumulado
  FROM acumulado a
  ORDER BY a.dia;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;
```

---

### Atualizar Interface `MetaAutomatica`

Adicionar novos campos para dados sazonais:

```typescript
export interface MetaAutomatica {
  // Existentes (renomeados para clareza)
  mediaBase: number;              // Média do mesmo mês em anos anteriores
  percentualCrescimento: number;
  metaCalculada: number;
  
  // Novos campos para sazonalidade
  anosUsados: number[];           // Ex: [2025, 2024]
  faturamentosPorAno: Record<string, number>; // { "2025": 231253, "2024": 0 }
  temHistoricoSazonal: boolean;   // Se há dados do mesmo mês em anos anteriores
  
  // Ritmo sazonal
  percentualEsperadoHoje: number; // % esperado até hoje baseado na curva
  percentualRealizado: number;    // % realizado (faturamento / meta)
  diferencaRitmo: number;         // realizado - esperado (em pontos percentuais)
  curvaDisponivel: boolean;       // Se há curva histórica
  
  // Campos existentes mantidos
  faturamentoAtualMes: number;
  percentualAtingido: number;
  diferencaPrevisao: number;
  statusMeta: 'acima' | 'abaixo' | 'atingida' | 'noritmo';
}
```

---

### Atualizar `useDashboardData.ts`

**1. Novas queries para dados sazonais:**

```typescript
// Buscar média do mesmo mês em anos anteriores
const mediaSazonal = await supabase.rpc('get_media_mes_anos_anteriores', {
  p_user_id: user.id,
  p_mes: mesAtual + 1, // 1-12
  p_limite_anos: 5
});

// Buscar curva de ritmo do mês
const curvaMes = await supabase.rpc('get_curva_mes', {
  p_user_id: user.id,
  p_mes: mesAtual + 1
});
```

**2. Lógica de cálculo atualizada:**

```typescript
// Meta sazonal: média do mesmo mês + % crescimento
const mediaBase = mediaSazonal.data?.[0]?.media_faturamento || 0;
const anosUsados = mediaSazonal.data?.[0]?.anos_usados || [];
const temHistoricoSazonal = anosUsados.length > 0;

// Fallback: se não tem histórico sazonal, usar média 3 meses
const metaCalculada = temHistoricoSazonal
  ? mediaBase * (1 + percentualCrescimento)
  : media3Meses * (1 + percentualCrescimento);

// Ritmo sazonal: buscar % esperado para o dia atual
const curvaData = curvaMes.data || [];
const diaAtual = getDate(now);
const curvaDisponivel = curvaData.length > 0;

// Encontrar % esperado até hoje (interpolando se necessário)
let percentualEsperadoHoje = (diaAtual / diasTotais) * 100; // fallback linear
if (curvaDisponivel) {
  const curvaAteDia = curvaData.filter(c => c.dia <= diaAtual);
  if (curvaAteDia.length > 0) {
    percentualEsperadoHoje = curvaAteDia[curvaAteDia.length - 1].percentual_acumulado;
  }
}

// Cálculo de ritmo
const percentualRealizado = metaCalculada > 0 
  ? (faturamentoAtual / metaCalculada) * 100 
  : 0;
const diferencaRitmo = percentualRealizado - percentualEsperadoHoje;

// Status atualizado com tolerância de ±5%
const statusMeta = 
  percentualRealizado >= 100 ? 'atingida' :
  diferencaRitmo >= 5 ? 'acima' :
  diferencaRitmo >= -5 ? 'noritmo' : 'abaixo';
```

---

### Atualizar `Dashboard.tsx`

**Card de Meta reformulado com indicadores sazonais:**

```
┌──────────────────────────────────────────────────────┐
│ Meta Mensal                    jan/25 + 10%  ⚙️     │
│ R$ 254.378                                          │
│ Base sazonal: jan/2025 (R$ 231.253)                 │
├─────────────────┬─────────────────┬─────────────────┤
│ Faturamento     │ Previsão        │ Ritmo Sazonal   │
│ R$ 311.757      │ R$ 354.000      │ 122.6% realizado│
│ 122.6% da meta  │ +R$ 99.6k       │ vs 89% esperado │
│                 │                 │ +33.6pp ✅      │
├─────────────────┴─────────────────┴─────────────────┤
│ [============================●───] 89% esperado     │
│ [=================================●] 122.6% atual   │
│                                                      │
│ ✅ Acima do ritmo sazonal para este dia do mês!     │
└──────────────────────────────────────────────────────┘
```

**Novos indicadores:**

| Indicador | Descrição |
|-----------|-----------|
| **% Esperado** | Curva histórica: quanto deveria ter vendido até hoje |
| **% Realizado** | Faturamento atual ÷ Meta |
| **Diferença (pp)** | Realizado - Esperado em pontos percentuais |
| **Status** | "Acima" (+5pp) / "No ritmo" (±5pp) / "Abaixo" (-5pp) |

---

### Fallback (sem histórico sazonal)

Se não houver dados do mesmo mês em anos anteriores:

```typescript
if (!temHistoricoSazonal) {
  // Meta: média últimos 3 meses
  const metaCalculada = media3Meses * (1 + percentualCrescimento);
  
  // Ritmo: curva linear
  const percentualEsperadoHoje = (diaAtual / diasTotais) * 100;
}
```

**UI com badge:**
```
Meta Mensal                    [⚠️ Sem histórico sazonal]
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova tabela `curvas_mensais` + funções RPC |
| `src/hooks/useDashboardData.ts` | Lógica de meta sazonal + ritmo com curva |
| `src/pages/Dashboard.tsx` | Card com % esperado vs % realizado |
| `src/hooks/useMetasMensais.ts` | Atualizar para persistir dados sazonais |

---

## Resultado Esperado

### Cenário: Janeiro 2026, Dia 27

| Métrica | Atual (3 meses) | Sazonal (mesmo mês) |
|---------|-----------------|---------------------|
| Média Base | R$ 458.251 (out-dez) | R$ 231.253 (jan/25) |
| Meta (+10%) | R$ 504.076 | R$ 254.378 |
| % Esperado | 87.1% (linear) | 89.3% (curva jan) |
| % Realizado | 61.8% | 122.6% |
| Status | ⚠️ Abaixo | ✅ Meta atingida |

**Vantagem:** O sistema deixa de comparar janeiro com dezembro (mês atípico de Natal) e passa a usar o histórico específico de janeiro, evitando alertas falsos.

---

## Critérios de Aceite

| Cenário | Resultado Esperado |
|---------|-------------------|
| Meta janeiro | Usar jan/2025 como base (R$ 231k), não média 3 meses |
| Ritmo dia 27 | Mostrar "122.6% vs 89% esperado" com curva sazonal |
| Sem histórico sazonal | Fallback para média 3 meses + badge de aviso |
| Status | Refletir posição real vs. padrão histórico do mês |
| Persistência | Salvar meta calculada na tabela `metas_mensais` |

