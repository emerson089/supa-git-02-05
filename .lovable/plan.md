
## Plano: Corrigir Cálculo da Meta Automática Mensal

### Problema Identificado

A Meta Mensal mostra R$ 0,00 porque a lógica de agrupamento por mês está usando `paid_at` como data de referência. Porém, quando o trigger de preenchimento automático do `paid_at` foi executado, ele atualizou **pedidos históricos** com a data de **janeiro de 2026** (data da execução do trigger).

**Exemplo do problema:**
- Pedido criado em 22/12/2025 (`created_at`)
- Marcado como PAGO retroativamente, trigger preencheu `paid_at = 2026-01-19`
- Código agrupa pelo `paid_at` = janeiro
- Resultado: dezembro fica sem dados, janeiro recebe tudo

**Dados reais:**
- 911 pedidos de setembro-dezembro 2025 
- Faturamento total: R$ 1.734.379
- Todos estão sendo agrupados em janeiro ao invés dos meses corretos

---

### Solução Proposta

**Usar `created_at` como referência temporal principal** para cálculo de métricas históricas, mantendo `paid_at` apenas para ordenação visual de pedidos recentes.

#### Opção A: Ajustar código JavaScript (Recomendada)

Modificar a lógica de agrupamento no `useDashboardData.ts`:

```typescript
// ANTES (problemático):
const dataEfetiva = p.paid_at || p.created_at;

// DEPOIS (corrigido):
// Para cálculo de média histórica, sempre usar created_at
// pois paid_at foi preenchido retroativamente com data errada
const dataEfetiva = p.created_at;
```

#### Opção B: Usar função RPC do banco

Usar a função `get_faturamento_periodo` já criada que faz o COALESCE corretamente:

```typescript
const [fat1, fat2, fat3] = await Promise.all([
  supabase.rpc('get_faturamento_periodo', {
    p_user_id: user.id,
    p_inicio: mes1Inicio.toISOString(),
    p_fim: mes1Fim.toISOString(),
  }),
  // ... outros meses
]);
```

---

### Alterações Técnicas

#### Arquivo: `src/hooks/useDashboardData.ts`

**1. Modificar linha 653** - Usar `created_at` para agrupamento histórico:
```typescript
// Linha 653 - ANTES:
const dataEfetiva = p.paid_at || p.created_at;

// DEPOIS:
// Para cálculo de média histórica, usar created_at
// porque paid_at foi preenchido retroativamente em alguns casos
const dataEfetiva = p.created_at;
```

**2. Alternativamente, usar RPC** para os 3 meses anteriores:
```typescript
// Substituir queries manuais por chamadas RPC
const [fatMes1, fatMes2, fatMes3] = await Promise.all([
  supabase.rpc('get_faturamento_periodo', {
    p_user_id: user.id,
    p_inicio: mes1Inicio.toISOString(),
    p_fim: mes1Fim.toISOString(),
  }),
  supabase.rpc('get_faturamento_periodo', {
    p_user_id: user.id,
    p_inicio: mes2Inicio.toISOString(),
    p_fim: mes2Fim.toISOString(),
  }),
  supabase.rpc('get_faturamento_periodo', {
    p_user_id: user.id,
    p_inicio: mes3Inicio.toISOString(),
    p_fim: mes3Fim.toISOString(),
  }),
]);

// Usar diretamente os valores retornados
const somaMeses = [
  fatMes1.data || 0,
  fatMes2.data || 0,
  fatMes3.data || 0,
];
```

---

### Resultado Esperado

Com a correção, o Dashboard passará a mostrar:

| Métrica | Valor Aproximado |
|---------|------------------|
| Média 3 meses (set-nov-dez/2025) | ~R$ 458.000 |
| Meta (+10%) | ~R$ 503.800 |
| Faturamento jan/2026 | R$ 6.504.632 |
| % Atingido | ~1290% |
| Status | Meta atingida |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Corrigir lógica de agrupamento ou usar RPC |

---

### Recomendação

A **Opção A** (usar `created_at`) é mais simples e resolve o problema imediatamente. A Opção B (RPC) é mais robusta para futuro mas requer mais mudanças.

Ambas funcionam - a diferença é que:
- `created_at` = data em que o pedido foi criado
- `COALESCE(paid_at, created_at)` = data do pagamento real (quando disponível)

Para dados históricos importados, `created_at` é mais confiável porque representa a data original do pedido.
