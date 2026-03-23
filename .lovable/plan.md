

## Diagnóstico: Cálculos de valores nos pedidos

Após análise detalhada do código, a lógica de cálculo está **majoritariamente correta**, mas há **um bug importante** no modal de edição que pode causar valores incorretos.

### O que está correto

- **Criação do pedido** (`NovoPedido.tsx`): `valorTotal = valorItens + taxaExcursao - desconto` ✓
- **Edição de itens** (add/update/remove): Os `precomputedTotals` recalculam corretamente com base no `pedido.valor_total` atual ✓
- **Exibição do valor com desconto**: A fórmula `pedido.valor_total + oldDesconto - newDesconto` está correta ✓

### Bug encontrado

**No `handleSaveDesconto` do `EditPedidoModal.tsx`**: quando o desconto é salvo, o código faz um `supabase.update()` direto **sem invalidar o cache do React Query**. Resultado:

1. Usuário abre o modal → `pedido.valor_total = 500`, `pedido.desconto = 0`
2. Usuário define desconto = 20 → salva → DB agora tem `valor_total = 480`, `desconto = 20`
3. **Mas o `pedido` prop ainda mostra os valores antigos** (500 e 0)
4. Se o usuário editar um item em seguida, o `precomputedTotals` calcula com base no valor antigo (500), gerando total errado no banco

### Plano de correção

**Arquivo: `src/components/pedidos/EditPedidoModal.tsx`**

1. Após salvar o desconto com sucesso, **invalidar as queries** `['pedido', pedidoId]`, `['pedidos-paginated']` e `['pedidos-totals']` para que os dados sejam re-fetched e o modal trabalhe com valores atualizados
2. Importar `useQueryClient` do React Query e chamar `invalidateQueries` no `handleSaveDesconto` após o update bem-sucedido

### Detalhes técnicos

```typescript
// Adicionar no handleSaveDesconto, após o supabase.update() com sucesso:
const queryClient = useQueryClient();
// ...
queryClient.invalidateQueries({ queryKey: ['pedido', pedido.id] });
queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
```

Alteração mínima — 1 arquivo, ~5 linhas adicionadas.

