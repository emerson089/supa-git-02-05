

## Plano: Corrigir cálculo de totais no EditPedidoModal

### Causa raiz

Os `precomputedTotals` fazem cálculos incrementais baseados em `pedido.total_pecas` e `pedido.valor_total` (valores da prop/banco). Se esses valores já estiverem incorretos por edições anteriores ou por timing de cache, o erro se propaga em cada operação subsequente.

### Correção

**Arquivo: `src/components/pedidos/EditPedidoModal.tsx`**

Em vez de usar cálculos incrementais (`pedido.total_pecas + X`), recalcular os totais **a partir dos itens reais** do pedido após cada mutação:

1. **Remover todos os `precomputedTotals`** das mutações (add, update, remove, addGrade)
2. Deixar a função `syncPedidoTotals` em `usePedidoItensData.ts` fazer o cálculo correto — ela já tem um fallback que busca todos os itens do pedido e soma `quantidade` e `quantidade * valor_unitario` quando `precomputed` não é passado
3. O `refetchPedido` já existente garante que o modal atualiza após cada mutação

Isso é mais seguro porque a fonte de verdade passa a ser sempre os itens reais no banco, não um cálculo incremental baseado em valores possivelmente stale.

### Detalhes técnicos

Nas 4 chamadas de mutação no EditPedidoModal, remover o parâmetro `precomputedTotals`:

```typescript
// ANTES (em handleUpdateItem, handleRemoveItem, handleAddAvulso, handleAddGrade):
const precomputedTotals = {
  total_pecas: pedido.total_pecas + X,
  valor_total: pedido.valor_total + Y,
};
addItemMutation.mutateAsync({ ...item, precomputedTotals });

// DEPOIS:
addItemMutation.mutateAsync({ ...item });
// syncPedidoTotals recalcula automaticamente somando todos os pedido_itens
```

### Resumo
- 1 arquivo alterado (`EditPedidoModal.tsx`)
- ~20 linhas removidas (blocos de `precomputedTotals`)
- Totais passam a ser recalculados a partir dos itens reais no banco, eliminando divergências

