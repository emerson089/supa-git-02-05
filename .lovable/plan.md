

## Plano: Corrigir Gráfico de Tendência de Vendas

### Problema Identificado

O gráfico de **Tendência de Vendas** agrupa todos os pedidos em um único ponto (janeiro/2026) porque:

1. O código usa `paid_at` como data de referência para agrupamento
2. O campo `paid_at` foi **preenchido retroativamente** em janeiro/2026 para todos os pedidos históricos
3. Pedidos criados entre agosto e novembro de 2025 têm `paid_at` em janeiro/2026

**Evidência do banco de dados:**

| Período Selecionado | created_at | paid_at | Resultado no Gráfico |
|---------------------|------------|---------|----------------------|
| Ago-Nov 2025 | 2025-08-06 | 2026-01-15 | Agrupado em Jan/26 |
| Ago-Nov 2025 | 2025-10-07 | 2026-01-15 | Agrupado em Jan/26 |

Isso explica porque o usuário vê 630 pedidos concentrados em um único dia de janeiro/2026.

---

### Solução

Alterar a lógica de agrupamento do gráfico de Tendência de Vendas para usar `created_at` (data de criação do pedido) em vez de `paid_at` (data de pagamento).

**Justificativa:**
- O campo `paid_at` foi preenchido retroativamente via trigger em 2026, distorcendo dados históricos
- Para análise de tendências, a data de criação do pedido é mais relevante
- Os KPIs de faturamento podem continuar usando `paid_at` para métricas financeiras, mas o gráfico de tendência deve refletir a distribuição temporal real dos pedidos

---

### Alteração no Código

**Arquivo:** `src/hooks/useDashboardData.ts`

**Localização:** Linhas 548-574 (agrupamento de vendas)

**De:**
```typescript
pedidosPagos.forEach(p => {
  // Usar paid_at quando disponível (preferido), fallback para created_at
  const dataEfetiva = p.paid_at || p.created_at;
  const dataCompleta = parseISO(dataEfetiva);
  // ...
});
```

**Para:**
```typescript
pedidosPagos.forEach(p => {
  // CORRIGIDO: Usar created_at para tendências históricas
  // O paid_at foi preenchido retroativamente em 2026, distorcendo dados antigos
  const dataEfetiva = p.created_at;
  const dataCompleta = parseISO(dataEfetiva);
  // ...
});
```

---

### Arquivos Impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useDashboardData.ts` | Linha 553 - Usar `created_at` no agrupamento |

---

### Impacto da Mudança

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Gráfico Ago-Nov/2025 | Tudo em Jan/26 | Distribuído por mês correto |
| Pedidos novos (2026+) | Funciona | Funciona |
| KPIs de faturamento | Sem mudança | Sem mudança |

---

### Resultado Esperado

O gráfico de Tendência de Vendas mostrará a distribuição correta dos pedidos ao longo do período selecionado, com pontos em agosto, setembro, outubro e novembro de 2025 (cada mês com seus pedidos reais).

